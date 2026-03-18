const Recipe = use('App/Models/Recipe');
const Drive = use('Drive');
const { validateAll } = use('Validator');
const Env = use('Env');

const debug = require('../../../../preload-safe-debug')(
  'Ferdium:internalServer:RecipeController',
);
const { LIVE_FERDIUM_API } = require('../../../../config');
const { convertToJSON } = require('../../../../jsUtils');
const { API_VERSION } = require('../../../../environment-remote');

const RECIPES_URL = `${LIVE_FERDIUM_API}/${API_VERSION}/recipes`;

// Only allow these service recipe IDs
const ALLOWED_RECIPE_IDS = new Set([
  'discord',
  'android-messages',
  'whatsapp',
  'stoat',
  'singularity-sales-platform',
]);

const filterAllowedRecipes = recipes =>
  recipes.filter(r => ALLOWED_RECIPE_IDS.has(r.id));

// Built-in recipes provided by this fork
const BUILTIN_RECIPES = [
  {
    id: 'singularity-sales-platform',
    name: 'Singularity Sales Platform',
    icon: 'https://singularitysalesplatform.com/favicon.ico',
    featured: false,
    aliases: [],
  },
];

class RecipeController {
  // List official and custom recipes
  async list({ response }) {
    const recipesUrlFetch = await fetch(RECIPES_URL);
    const officialRecipes = filterAllowedRecipes(
      convertToJSON(await recipesUrlFetch.text()),
    );
    const allRecipes = await Recipe.all();
    const customRecipesArray = allRecipes.rows;
    const customRecipes = filterAllowedRecipes(
      customRecipesArray.map(recipe => ({
        id: recipe.recipeId,
        name: recipe.name,
        ...convertToJSON(recipe.data),
      })),
    );

    // Merge: built-in > official > custom (dedup by id, built-in takes precedence)
    const seen = new Set();
    const recipes = [...BUILTIN_RECIPES, ...officialRecipes, ...customRecipes].filter(
      r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      },
    );

    return response.send(recipes);
  }

  // Search official and custom recipes
  async search({ request, response }) {
    // Validate user input
    const validation = await validateAll(request.all(), {
      needle: 'required',
    });
    if (validation.fails()) {
      return response.status(401).send({
        message: 'Please provide a needle',
        messages: validation.messages(),
        status: 401,
      });
    }

    const needle = request.input('needle');

    // Include built-in recipes that match the search needle
    const builtinMatches = BUILTIN_RECIPES.filter(
      r => needle === 'ferdium:custom' || r.name.toLowerCase().includes(needle.toLowerCase()),
    );

    // Get results
    let results;

    if (needle === 'ferdium:custom') {
      const allRecipes = await Recipe.all();
      const dbResults = allRecipes.toJSON();
      results = dbResults.map(recipe => ({
        id: recipe.recipeId,
        name: recipe.name,
        ...convertToJSON(recipe.data),
      }));
    } else {
      let remoteResults = [];

      if (Env.get('CONNECT_WITH_FRANZ') === 'true') {
        const recipesUrlFetch = await fetch(
          `${RECIPES_URL}/search?needle=${encodeURIComponent(needle)}`,
        );
        remoteResults = convertToJSON(await recipesUrlFetch.text());
      }

      debug('remoteResults:', remoteResults);

      const recipeQuery = await Recipe.query()
        .where('name', 'LIKE', `%${needle}%`)
        .fetch();
      const localResultsArray = recipeQuery.toJSON();
      const localResults = localResultsArray.map(recipe => ({
        id: recipe.recipeId,
        name: recipe.name,
        ...convertToJSON(recipe.data),
      }));

      debug('localResults:', localResults);

      results = [...localResults, ...(remoteResults || [])];
    }

    // Merge built-in matches (dedup by id)
    const seen = new Set(results.map(r => r.id));
    const merged = [
      ...results,
      ...builtinMatches.filter(r => !seen.has(r.id)),
    ];

    return response.send(filterAllowedRecipes(merged));
  }

  // Return an empty array
  update({ response }) {
    return response.send([]);
  }

  async popularRecipes({ response }) {
    const recipesUrlFetch = await fetch(`${RECIPES_URL}/popular`);
    const featuredRecipes = filterAllowedRecipes(
      convertToJSON(await recipesUrlFetch.text()),
    );
    return response.send(featuredRecipes);
  }

  // Download a recipe
  async download({ response, params }) {
    // Validate user input
    const validation = await validateAll(params, {
      recipe: 'required|accepted',
    });
    if (validation.fails()) {
      return response.status(401).send({
        message: 'Please provide a recipe ID',
        messages: validation.messages(),
        status: 401,
      });
    }

    const service = params.recipe;

    // Only allow downloading recipes from the allowed list
    if (!ALLOWED_RECIPE_IDS.has(service)) {
      return response.status(403).send({
        message: 'Recipe not allowed',
        code: 'recipe-not-allowed',
      });
    }

    // Check for invalid characters
    if (/\.+/.test(service) || /\/+/.test(service)) {
      return response.send('Invalid recipe name');
    }

    // Check if recipe exists in recipes folder
    if (await Drive.exists(`${service}.tar.gz`)) {
      return response.send(await Drive.get(`${service}.tar.gz`));
    }

    if (Env.get('CONNECT_WITH_FRANZ') === 'true') {
      return response.redirect(`${RECIPES_URL}/download/${service}`);
    }
    return response.status(400).send({
      message: 'Recipe not found',
      code: 'recipe-not-found',
    });
  }
}

module.exports = RecipeController;
