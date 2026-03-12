import { getCookie, setCookie, deleteCookie } from "cookies-next";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

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
      throw { data, status: response.status };
    }

    return data;
  } catch (error) {
    const isClientError = error.status >= 400 && error.status < 500;

    if (retries > 0 && !isClientError) {
      console.warn(`Retrying... attempts left: ${retries}`);
      await new Promise(res => setTimeout(res, 1000));
      return request(endpoint, method, body, retries - 1);
    }

    throw new Error(error.data?.detail || error.data?.message || "Something went wrong");
  }
}

// Separate function for file uploads (multipart/form-data)
async function uploadFile(endpoint, file) {
  const token = getCookie("token");

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // Do NOT set Content-Type — browser sets it automatically with boundary
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || data?.message || "Upload failed");
  }

  return data;
}

export const RestaurantAPI = {
  get: () => request("/restaurant/get", "POST"),
  create: (payload) => request("/restaurant/create", "POST", payload),
  update: (payload) => request("/restaurant/update", "PUT", payload),
}

export const AuthAPI = {
  login: async (email, password) => {
    const data = await request("/login", "POST", { email, password });
    setCookie("token", data.token, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
    });
    return data;
  },

  register: (payload) => request("/register", "POST", payload),

  logout: () => deleteCookie("token"),

  me: () => request("/user/me", "GET"),
}

export const StaffAPI = {
  list: () => request("/staff/list"),
  create: (name, role) => request("/staff/create", "POST", { name, role }),
  update: (staff_id, name, role) => request("/staff/update", "PUT", { staff_id, name, role }),
  delete: (staff_id) => request("/staff/delete", "DELETE", { staff_id }),
}

export const IngredientAPI = {
  list: (filters) => request("/ingredient/list", "POST", filters),
  create: (payload) => request("/ingredient/create", "POST", payload),
  updateStock: (payload) => request("/ingredient/update-stock", "PUT", payload),
  status: (ingredient_id) => request("/ingredient/status", "POST", { ingredient_id }),
  log: (ingredient_id) => request("/ingredient/log", "POST", { ingredient_id }),
  delete: (ingredient_id) => request("/ingredient/delete", "DELETE", { ingredient_id }),
}

export const MenuAPI = {
  list: () => request("/menu/list"),
  create: (payload) => request("/menu/create", "POST", payload),
  update: (payload) => request("/menu/update", "PUT", payload),
  delete: (menu_id) => request("/menu/delete", "DELETE", { menu_id }),
  getById: (restaurant_id, menu_id) => request("/menu/detail", "POST", { menu_id }),
  addIngredientToRecipe: (payload) => request("/recipe/add", "POST", payload),
}

export const RecipeAPI = {
  getDetail: (menu_id) => request("/recipe/detail", "POST", { menu_id }),
}

export const ReportAPI = {
  revenue: (menu_id, dateRange = {}) =>
    request("/report/revenue", "POST", { menu_id, ...dateRange }),
 
  orders: (menu_id, dateRange = {}) =>
    request("/report/orders", "POST", { menu_id, ...dateRange }),
 
shareMenu: (start_date, end_date) =>
    request("/report/share/menu", "POST", { start_date: start_date || null, end_date: end_date || null }),

  shareCategory: (start_date, end_date) =>
    request("/report/share/category", "POST", { start_date: start_date || null, end_date: end_date || null }),

 
  trendMenu: (menu_id, dateRange = {}) =>
    request("/report/trend/menu", "POST", { menu_id, ...dateRange }),
 
  trendIngredient: (ingredient_id, dateRange = {}) =>
    request("/report/trend/ingredient", "POST", { ingredient_id, ...dateRange }),
}
 

export const PredictAPI = {
  report: () => request("/predict/report"),
  trend: (ingredient_id) => request("/predict/trend", "POST", { ingredient_id }),
}

export const ImportAPI = {
  sales: (file) => uploadFile("/import/sales", file),
}