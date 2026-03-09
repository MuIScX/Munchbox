import { getCookie,setCookie } from "cookies-next";

const BASE_URL = "https://0rq0s26b-5000.asse.devtunnels.ms/api";

async function request(endpoint, method = "POST", body = null, retries = 3) {
  const token = getCookie("token");

  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null,
    });

    const data = await response.json();

    if (!response.ok) {
      // If we have retries left, throw to trigger the catch block
      throw { data, status: response.status };
    }

    return data;
  } catch (error) {
    // Check if we should retry: 
    // We retry if we have attempts left AND it's not a 4xx client error (like 401 or 404)
    const isClientError = error.status >= 400 && error.status < 500;
    
    if (retries > 0 && !isClientError) {
      console.warn(`Retrying... attempts left: ${retries}`);
      
      // Optional: Wait 1 second before retrying
      await new Promise(res => setTimeout(res, 1000));
      
      return request(endpoint, method, body, retries - 1);
    }

    // If no retries left or it's a permanent error, throw the final error
    throw new Error(error.data?.message || "Something went wrong");
  }
}

export const AuthAPI = {
  login: async (email, password) => {
    console.log(email)
    console.log(password)
    const data = await request("/login", "POST", { email, password })
    console.log(data)
    // Save token in cookie
    setCookie("token", data.token, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
      sameSite: "lax",
    })

    return data
  },

  register: (payload) => {
    return request("/register", "POST", payload)
  },

  logout: () => {
    deleteCookie("token")
  },
}


export const StaffAPI = {
  list: () => request("/staff/list"),

  create: (name, role) =>
    request("/staff/create", "POST", { name, role }),

  update: (staff_id, name, role) =>
    request("/staff/update", "PUT", { staff_id, name, role }),

  delete: (staff_id) =>
    request("/staff/delete", "DELETE", { staff_id }),
}
export const IngredientAPI = {
  list: (filters) =>
    request("/ingredient/list", "POST", filters),

  create: (payload) =>
    request("/ingredient/create", "POST", payload),

  updateStock: (payload) =>
    request("/ingredient/update-stock", "PUT", payload),

  status: (ingredient_id) =>
    request("/ingredient/status", "POST", { ingredient_id }),

  log: (ingredient_id) =>
    request("/ingredient/log", "POST", { ingredient_id }),

  delete: (ingredient_id) =>
  request("/ingredient/delete", "DELETE", { ingredient_id }),
}
export const MenuAPI = {
  list: () => request("/menu/list"),

  create: (payload) =>
    request("/menu/create", "POST", payload),

  update: (payload) =>
    request("/menu/update", "PUT", payload),

  delete: (menu_id) =>
    request("/menu/delete", "DELETE", { menu_id }),

  getById: (restaurant_id, menu_id) =>
    request("/menu/detail", "POST", { menu_id }),

  addIngredientToRecipe: (payload) =>
    request("/recipe/add", "POST", payload),
}

export const RecipeAPI = {
  // ... ฟังก์ชัน add, edit, delete เดิมของคุณ ...
  
  getDetail: (menu_id) => 
    request("/recipe/detail", "POST", { menu_id }),
}
export const ReportAPI = {
  revenue: (menu_id) =>
    request("/report/revenue", "POST", { menu_id }),

  orders: (menu_id) =>
    request("/report/orders", "POST", { menu_id }),

  shareMenu: () =>
    request("/report/share/menu"),

  shareCategory: () =>
    request("/report/share/category"),

  trendMenu: (menu_id) =>
    request("/report/trend/menu", "POST", { menu_id }),

  trendIngredient: (ingredient_id) =>
    request("/report/trend/ingredient", "POST", { ingredient_id }),
}
export const PredictAPI = {
  report: () =>
    request("/predict/report"),

  trend: (ingredient_id) =>
    request("/predict/trend", "POST", { ingredient_id }),
}

