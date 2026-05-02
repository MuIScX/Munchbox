import { getCookie, setCookie, deleteCookie } from "cookies-next";

const BASE_URL =  process.env.NEXT_PUBLIC_API_URL;

async function request(endpoint, method = "POST", body = null, retries = 3) {
  const token = getCookie("staff_token") || getCookie("token");

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

  logout: () => {
    deleteCookie("token");
    deleteCookie("staff_token");
  },

  me: () => request("/user/me", "GET"),
}

const STAFF_ROLE_MAP = { 1: "Admin", 2: "Manager", 3: "Staff", 4: "Chef", 5: "Cashier" };

function decodeJwt(token) {
  try { return JSON.parse(atob(token.split('.')[1])); } catch { return null; }
}

export const StaffSession = {
  set: (token) => setCookie("staff_token", token, { maxAge: 60 * 60 * 24, path: "/", sameSite: "lax" }),
  get: () => {
    const token = getCookie("staff_token");
    if (!token) return null;
    const p = decodeJwt(token);
    if (!p || !p.staffId) return null;
    return { id: p.staffId, name: p.name, username: p.username, role: p.role, roleLabel: STAFF_ROLE_MAP[p.role] ?? "Staff" };
  },
  clear: () => deleteCookie("staff_token"),
}

export const StaffAPI = {
  list: () => request("/staff/list"),
  login: async (username, password) => {
    const data = await request("/staff/login", "POST", { username, password });
    StaffSession.set(data.token);
    return data;
  },
  create: (name, username, password, role) => request("/staff/create", "POST", { name, username, password, role }),
  update: (staff_id, name, role) => request("/staff/update", "PUT", { staff_id, name, role }),
  delete: (staff_id) => request("/staff/delete", "DELETE", { staff_id }),
  verifyManagerPin: (pin) => request("/staff/verify-manager-pin", "POST", { pin: parseInt(pin) }),
  selfUpdate: async (payload) => {
    const data = await request("/staff/self-update", "PUT", payload);
    if (data.token) StaffSession.set(data.token);
    return data;
  },
}

export const IngredientAPI = {
  list: (filters) => request("/ingredient/list", "POST", filters),
  create: (payload) => request("/ingredient/create", "POST", payload),
  updateStock: (updates, staff_id, action_type) => request("/ingredient/update-stock", "PUT", { updates, staff_id, action_type }),
  updateDetail: (payload) => request("/ingredient/update-detail", "PUT", payload),
  status: (ingredient_id) => request("/ingredient/status", "POST", { ingredient_id }),
  log: (ingredient_id) => request("/ingredient/log", "POST", { ingredient_id }),
  delete: (ingredient_id) => request("/ingredient/delete", "DELETE", { ingredient_id }),
}

export const MenuAPI = {
  list: () => request("/menu/list"),
  create: (payload) => request("/menu/create", "POST", payload),
  update: (payload) => request("/menu/update", "PUT", payload),
  delete: (menu_id) => request("/menu/delete", "DELETE", { menu_id }),
  getById: (menu_id) => request("/menu/detail", "POST", { menu_id }),
  addIngredientToRecipe: (payload) => request("/recipe/add", "POST", payload),
}

export const RecipeAPI = {
  getMap: () => request("/recipe/map", "POST"),
  getDetail: (menu_id) => request("/recipe/detail", "POST", { menu_id }),
  edit: (payload) => request("/recipe/edit", "PUT", payload),
  delete: (menu_id, ingredient_id) => request("/recipe/delete", "DELETE", { menu_id, ingredient_id }),
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
 
export const SaleAPI = {
  record: (items = [], sale_date = null) => request("/sale/record", "POST", { items, sale_date }),
};

export const PredictAPI = {
  report: (days = null) => request("/predict/report", "POST", { days }),
  trend: (ingredient_id) => request("/predict/trend", "POST", { ingredient_id }),
  actual: (ingredient_id, start_date = null, end_date = null) => request("/predict/actual", "POST", { ingredient_id, start_date, end_date }),
  dailyForecast: (ingredient_id, predict_set_id = null) =>
    request("/predict/ingredient-forecast", "POST", { ingredient_id, predict_set_id }),
  sets: (ingredient_id) => request("/predict/sets", "POST", { ingredient_id }),
  prepSummary: (start_date = null, end_date = null) =>
    request("/predict/prep-summary", "POST", { start_date, end_date }),
  generate: (payload) => request("/predict/generate", "POST", payload, 0),
  generateMenu: (payload) => request("/predict/generate-menu", "POST", payload, 0),
  ingredient: (ingredient_id, days = null) => request("/predict/ingredient", "POST", { ingredient_id, days }),
  status: (ingredient_id, days = null) => request("/predict/status", "POST", { ingredient_id, days }),
  record: (predict_set_id, predictions) => request("/predict/record", "POST", { predict_set_id, predictions }),
  accuracy: (ingredient_id = null, start_date = null, end_date = null) =>
    request("/predict/accuracy", "POST", { ingredient_id, start_date, end_date }),
}

export const ImportAPI = {
  sales: (file) => uploadFile("/import/sales", file),
}