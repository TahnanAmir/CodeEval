import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  register: (payload: { name: string; email: string; password: string; role: string }) =>
    api.post("/auth/register", payload),
  login: (payload: { email: string; password: string }) => api.post("/auth/login", payload),
  logout: () => api.post("/auth/logout"),
};

export const submissionApi = {
  upload: (formData: FormData) =>
    api.post("/submissions", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getMine: () => api.get("/submissions/my"),
  getStats: () => api.get("/submissions/stats"),
  getAssignments: () => api.get("/submissions/assignments"),
  getAssignmentById: (assignmentId: string | number) => api.get(`/submissions/assignments/${assignmentId}`),
  getAssignmentPdf: (assignmentId: string | number) =>
    api.get(`/submissions/assignments/${assignmentId}/pdf`, { responseType: "blob" }),
};

export const feedbackApi = {
  getBySubmission: (submissionId: string) => api.get(`/feedback/${submissionId}`),
};

export const evaluationApi = {
  trigger: (submissionId: string | number) => api.post(`/evaluations/${submissionId}/trigger`),
  triggerBatch: (submissionIds: (string | number)[]) =>
    api.post("/evaluations/batch/trigger", { submissionIds }),
};

export const instructorApi = {
  getAssignments: (instructorId: number | string) =>
    axios.get(`http://localhost:3001/instructor/dashboard/assignments`, {
      params: { instructorId },
      headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
    }),
  uploadAssignmentPdf: (assignmentId: string | number, pdf: File) => {
    const form = new FormData();
    form.append("pdf", pdf);
    return axios.post(`http://localhost:3001/instructor/assignments/${assignmentId}/pdf`, form, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        "Content-Type": "multipart/form-data",
      },
    });
  },
  updateRubric: (
    assignmentId: string | number,
    payload: { correctness_weight: number; style_weight: number; efficiency_weight: number; readability_weight: number },
  ) =>
    axios.put(`http://localhost:3001/instructor/assignments/${assignmentId}/rubric`, payload, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
    }),
};
