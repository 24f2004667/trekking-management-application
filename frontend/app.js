const api = axios.create({ baseURL: "/api" });

const store = Vue.reactive({
  token: localStorage.getItem("tma_token") || null,
  user: JSON.parse(localStorage.getItem("tma_user") || "null"),
  page: "login",
  detailId: null,
  toast: null,
});

api.interceptors.request.use((config) => {
  if (store.token) config.headers.Authorization = "Bearer " + store.token;
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response && err.response.status === 401) doLogout();
    return Promise.reject(err);
  }
);

function toast(msg, type = "success") {
  store.toast = { msg, type };
  setTimeout(() => { if (store.toast && store.toast.msg === msg) store.toast = null; }, 3000);
}
function apiError(err, fallback) {
  return (err.response && err.response.data && err.response.data.error) || fallback || "Something went wrong";
}
function doLogin(token, user) {
  store.token = token;
  store.user = user;
  localStorage.setItem("tma_token", token);
  localStorage.setItem("tma_user", JSON.stringify(user));
  routeHome();
}
function doLogout() {
  store.token = null;
  store.user = null;
  localStorage.removeItem("tma_token");
  localStorage.removeItem("tma_user");
  store.page = "login";
}
function routeHome() {
  if (!store.user) { store.page = "login"; return; }
  if (store.user.role === "admin") store.page = "admin-dashboard";
  else if (store.user.role === "staff") store.page = "staff-dashboard";
  else store.page = "user-dashboard";
}
function go(page, id = null) { store.page = page; store.detailId = id; }

function statusBadgeClass(status) {
  const map = { Open: "badge-open", Closed: "badge-closed", Completed: "badge-completed", Cancelled: "badge-cancelled", Booked: "badge-booked", Pending: "bg-secondary", Approved: "bg-info" };
  return "badge " + (map[status] || "bg-secondary");
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "-"; }


const AppNavbar = {
  template: `
  <nav class="navbar navbar-expand navbar-dark px-3" style="background:#0f766e;">
    <span class="navbar-brand fw-bold"><i class="bi bi-mountain me-2"></i>SafarNama</span>
    <div class="ms-auto d-flex align-items-center text-white">
      <span class="me-3">{{ store.user.name }} <span class="badge bg-light text-dark text-capitalize">{{ roleLabel }}</span></span>
      <button class="btn btn-sm btn-outline-light" @click="logout"><i class="bi bi-box-arrow-right"></i> Logout</button>
    </div>
  </nav>`,
  data() { return { store }; },
  computed: { roleLabel() { return store.user.role === "trekker" ? "User" : store.user.role; } },
  methods: { logout() { doLogout(); } },
};

function sidebarLink(page, icon, label) {
  return `<a :class="{active: store.page==='${page}'}" @click="go('${page}')" href="#"><i class="bi ${icon} me-2"></i>${label}</a>`;
}

const AdminSidebar = {
  template: `<div class="sidebar p-2" style="width:220px;">
    ${sidebarLink("admin-dashboard", "bi-speedometer2", "Dashboard")}
    ${sidebarLink("admin-treks", "bi-signpost-2", "Treks")}
    ${sidebarLink("admin-staff", "bi-person-badge", "Trekking Staff")}
    ${sidebarLink("admin-users", "bi-people", "Users (Trekkers)")}
    ${sidebarLink("admin-bookings", "bi-journal-check", "Bookings")}
    ${sidebarLink("admin-search", "bi-search", "Search")}
    ${sidebarLink("admin-reports", "bi-bar-chart", "Reports")}
    ${sidebarLink("admin-profile", "bi-person-circle", "Profile")}
  </div>`,
  data() { return { store }; },
  methods: { go },
};

const StaffSidebar = {
  template: `<div class="sidebar p-2" style="width:220px;">
    ${sidebarLink("staff-dashboard", "bi-speedometer2", "Dashboard")}
    ${sidebarLink("staff-treks", "bi-signpost-2", "My Treks")}
    ${sidebarLink("staff-profile", "bi-person-circle", "Profile")}
  </div>`,
  data() { return { store }; },
  methods: { go },
};

const UserSidebar = {
  template: `<div class="sidebar p-2" style="width:220px;">
    ${sidebarLink("user-dashboard", "bi-speedometer2", "Dashboard")}
    ${sidebarLink("user-browse", "bi-compass", "Browse Treks")}
    ${sidebarLink("user-bookings", "bi-journal-check", "My Bookings")}
    ${sidebarLink("user-history", "bi-clock-history", "History")}
    ${sidebarLink("user-profile", "bi-person-circle", "Profile")}
  </div>`,
  data() { return { store }; },
  methods: { go },
};

//Auth Pages

//Login
const LoginPage = {
  template: `
  <div class="auth-wrap">
    <div class="card shadow-lg border-0 rounded-4 p-4" style="width:400px;">
      <div class="text-center mb-3">
        <i class="bi bi-mountain brand-color" style="font-size:2.5rem;"></i>
        <h4 class="fw-bold mt-2">Trekking Management</h4>
        <p class="text-muted small">Login to your account</p>
      </div>
      <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
      <form @submit.prevent="submit">
        <div class="mb-3"><label class="form-label">Email address</label>
          <input v-model="email" type="email" class="form-control" required></div>
        <div class="mb-3"><label class="form-label">Password</label>
          <input v-model="password" type="password" class="form-control" required></div>
        <button class="btn btn-brand w-100" type="submit" :disabled="loading">{{ loading ? 'Signing in...' : 'Login' }}</button>
      </form>
      <p class="text-center mt-3 mb-0 small">Don't have an account? <a href="#" @click.prevent="go('register')">Register as User (Trekker)</a></p>
      <div class="alert alert-info small mt-3 mb-0">Only Users (Trekkers) can register. Admin &amp; Trek Staff accounts are created for you.</div>
    </div>
  </div>`,
  data() { return { email: "", password: "", error: "", loading: false }; },
  methods: {
    go,
    async submit() {
      this.error = ""; this.loading = true;
      try {
        const { data } = await api.post("/login", { email: this.email, password: this.password });
        doLogin(data.token, data.user);
      } catch (err) { this.error = apiError(err, "Login failed"); }
      finally { this.loading = false; }
    },
  },
};

//Register
const RegisterPage = {
  template: `
  <div class="auth-wrap">
    <div class="card shadow-lg border-0 rounded-4 p-4" style="width:420px;">
      <div class="text-center mb-3">
        <i class="bi bi-person-plus brand-color" style="font-size:2.5rem;"></i>
        <h4 class="fw-bold mt-2">Create User Account</h4>
        <p class="text-muted small">Register as a Trekker</p>
      </div>
      <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
      <form @submit.prevent="submit">
        <div class="mb-2"><label class="form-label">Full Name</label>
          <input v-model="form.name" class="form-control" required></div>
        <div class="mb-2"><label class="form-label">Email address</label>
          <input v-model="form.email" type="email" class="form-control" required></div>
        <div class="mb-2"><label class="form-label">Contact Number</label>
          <input v-model="form.contact" class="form-control" placeholder="10 digit number" maxlength="10" pattern="[0-9]{10}" inputmode="numeric" title="Must be exactly 10 digits" required></div>
        <div class="mb-2"><label class="form-label">Password</label>
          <input v-model="form.password" type="password" class="form-control" required></div>
        <div class="mb-3"><label class="form-label">Confirm Password</label>
          <input v-model="confirm" type="password" class="form-control" required></div>
        <button class="btn btn-brand w-100" type="submit" :disabled="loading">{{ loading ? 'Creating...' : 'Register' }}</button>
      </form>
      <p class="text-center mt-3 mb-0 small">Already have an account? <a href="#" @click.prevent="go('login')">Login here</a></p>
    </div>
  </div>`,
  data() { return { form: { name: "", email: "", contact: "", password: "" }, confirm: "", error: "", loading: false }; },
  methods: {
    go,
    async submit() {
      this.error = "";
      if (this.form.password !== this.confirm) { this.error = "Passwords do not match"; return; }
      this.loading = true;
      try {
        await api.post("/register", this.form);
        toast("Registered successfully — please login");
        go("login");
      } catch (err) { this.error = apiError(err, "Registration failed"); }
      finally { this.loading = false; }
    },
  },
};

//ADMIN

//Admin->Dashboard

const AdminDashboardPage = {
  template: `
  <div>
    <h3 class="mb-4">Dashboard</h3>
    <div class="row g-3 mb-4">
      <div class="col-md-3"><div class="card stat-card p-3"><div class="text-muted small">Total Treks</div><div class="fs-3 fw-bold brand-color">{{ d.total_treks ?? '-' }}</div></div></div>
      <div class="col-md-3"><div class="card stat-card p-3"><div class="text-muted small">Total Users</div><div class="fs-3 fw-bold brand-color">{{ d.total_users ?? '-' }}</div></div></div>
      <div class="col-md-3"><div class="card stat-card p-3"><div class="text-muted small">Total Staff</div><div class="fs-3 fw-bold brand-color">{{ d.total_staff ?? '-' }}</div></div></div>
      <div class="col-md-3"><div class="card stat-card p-3"><div class="text-muted small">Total Bookings</div><div class="fs-3 fw-bold brand-color">{{ d.total_bookings ?? '-' }}</div></div></div>
    </div>
    <div class="card stat-card p-3">
      <h6 class="fw-bold">Recent Bookings</h6>
      <table class="table table-sm align-middle">
        <thead><tr><th>User</th><th>Trek</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="b in d.recent_bookings" :key="b.id">
            <td>{{ b.user_name }}</td><td>{{ b.trek_name }}</td><td>{{ fmtDate(b.booking_date) }}</td>
            <td><span :class="statusBadgeClass(b.status)">{{ b.status }}</span></td>
          </tr>
          <tr v-if="!d.recent_bookings || !d.recent_bookings.length"><td colspan="4" class="text-muted text-center">No bookings yet</td></tr>
        </tbody>
      </table>
    </div>
  </div>`,
  data() { return { d: {} }; },
  mounted() { this.load(); },
  methods: {
    fmtDate, statusBadgeClass,
    async load() { const { data } = await api.get("/admin/dashboard"); this.d = data; },
  },
};

//Admin->Treks
const AdminTreksPage = {
  template: `
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3>Treks</h3>
      <button class="btn btn-brand" @click="openCreate"><i class="bi bi-plus-lg"></i> Add New Trek</button>
    </div>
    <input class="form-control mb-3" style="max-width:300px" placeholder="Search treks..." v-model="q">
    <div class="card stat-card p-3">
      <table class="table align-middle">
        <thead><tr><th>ID</th><th>Name</th><th>Location</th><th>Difficulty</th><th>Slots</th><th>Staff</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="t in filtered" :key="t.id">
            <td>{{ t.id }}</td><td>{{ t.name }}</td><td>{{ t.location }}</td><td>{{ t.difficulty }}</td>
            <td>{{ t.available_slots }}/{{ t.total_slots }}</td>
            <td>{{ t.assigned_staff_name || '—' }}</td>
            <td><span :class="statusBadgeClass(t.status)">{{ t.status }}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-secondary me-1" @click="openEdit(t)"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-sm btn-outline-primary me-1" @click="openAssign(t)"><i class="bi bi-person-check"></i></button>
              <button class="btn btn-sm btn-outline-danger" @click="remove(t)"><i class="bi bi-trash"></i></button>
            </td>
          </tr>
          <tr v-if="!filtered.length"><td colspan="8" class="text-muted text-center">No treks found</td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal d-block" style="background:rgba(0,0,0,.5)">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">{{ editing ? 'Edit Trek' : 'Create New Trek' }}</h5>
          <button class="btn-close" @click="showModal=false"></button></div>
        <div class="modal-body">
          <div v-if="formError" class="alert alert-danger py-2">{{ formError }}</div>
          <div class="mb-2"><label class="form-label">Trek Name</label><input class="form-control" v-model="form.name"></div>
          <div class="mb-2"><label class="form-label">Location</label><input class="form-control" v-model="form.location"></div>
          <div class="row">
            <div class="col mb-2"><label class="form-label">Difficulty</label>
              <select class="form-select" v-model="form.difficulty"><option>Easy</option><option>Moderate</option><option>Hard</option></select></div>
            <div class="col mb-2"><label class="form-label">Duration (days)</label><input type="number" min="1" class="form-control" v-model.number="form.duration_days"></div>
          </div>
          <div class="row">
            <div class="col mb-2"><label class="form-label">Total Slots</label><input type="number" min="0" class="form-control" v-model.number="form.total_slots"></div>
            <div class="col mb-2"><label class="form-label">Start Date <span class="text-danger">*</span></label><input type="date" class="form-control" v-model="form.start_date" required></div>
          </div>
          <div class="mb-2" v-if="editing"><label class="form-label">Status</label>
            <select class="form-select" v-model="form.status"><option>Open</option><option>Closed</option><option>Completed</option></select></div>
          <div class="mb-2"><label class="form-label">Description</label><textarea class="form-control" v-model="form.description"></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" @click="showModal=false">Cancel</button>
          <button class="btn btn-brand" @click="save">{{ editing ? 'Update' : 'Create' }} Trek</button></div>
      </div></div>
    </div>

    <div v-if="showAssignModal" class="modal d-block" style="background:rgba(0,0,0,.5)">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Assign Staff — {{ assignTrek.name }}</h5>
          <button class="btn-close" @click="showAssignModal=false"></button></div>
        <div class="modal-body">
          <select class="form-select" v-model="assignStaffId">
            <option :value="null">— Unassigned —</option>
            <option v-for="s in staffList" :key="s.id" :value="s.id">{{ s.name }}</option>
          </select>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" @click="showAssignModal=false">Cancel</button>
          <button class="btn btn-brand" @click="saveAssign">Assign</button></div>
      </div></div>
    </div>
  </div>`,
  data() {
    return {
      treks: [], staffList: [], q: "", showModal: false, showAssignModal: false, editing: null,
      form: { name: "", location: "", difficulty: "Easy", duration_days: 1, total_slots: 10, start_date: "", status: "Open", description: "" },
      formError: "", assignTrek: null, assignStaffId: null,
    };
  },
  computed: {
    filtered() {
      const q = this.q.toLowerCase();
      return this.treks.filter((t) => !q || t.name.toLowerCase().includes(q) || t.location.toLowerCase().includes(q));
    },
  },
  mounted() { this.load(); },
  methods: {
    statusBadgeClass,
    async load() {
      const [tr, st] = await Promise.all([api.get("/admin/treks"), api.get("/admin/staff")]);
      this.treks = tr.data; this.staffList = st.data;
    },
    openCreate() {
      this.editing = null; this.formError = "";
      this.form = { name: "", location: "", difficulty: "Easy", duration_days: 1, total_slots: 10, start_date: "", status: "Open", description: "" };
      this.showModal = true;
    },
    openEdit(t) {
      this.editing = t; this.formError = "";
      this.form = { name: t.name, location: t.location, difficulty: t.difficulty, duration_days: t.duration_days, total_slots: t.total_slots, start_date: t.start_date || "", status: t.status, description: t.description || "" };
      this.showModal = true;
    },
    async save() {
      this.formError = "";
      if (!this.form.start_date) { this.formError = "Start date is required"; return; }
      try {
        if (this.editing) await api.put(`/admin/treks/${this.editing.id}`, this.form);
        else await api.post("/admin/treks", this.form);
        this.showModal = false; toast(this.editing ? "Trek updated" : "Trek created");
        this.load();
      } catch (err) { this.formError = apiError(err, "Save failed"); }
    },
    async remove(t) {
      if (!confirm(`Delete trek "${t.name}"? This cancels any active bookings.`)) return;
      await api.delete(`/admin/treks/${t.id}`);
      toast("Trek deleted"); this.load();
    },
    openAssign(t) { this.assignTrek = t; this.assignStaffId = t.assigned_staff_id; this.showAssignModal = true; },
    async saveAssign() {
      await api.put(`/admin/treks/${this.assignTrek.id}/assign-staff`, { staff_id: this.assignStaffId });
      this.showAssignModal = false; toast("Staff assigned"); this.load();
    },
  },
};

//Admin->Staff
const AdminStaffPage = {
  template: `
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3>Trekking Staff</h3>
      <button class="btn btn-brand" @click="openCreate"><i class="bi bi-plus-lg"></i> Add New Staff</button>
    </div>
    <input class="form-control mb-3" style="max-width:300px" placeholder="Search staff..." v-model="q">
    <div class="card stat-card p-3">
      <table class="table align-middle">
        <thead><tr><th>Name</th><th>Email</th><th>Contact</th><th>Assigned Treks</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          <tr v-for="s in filtered" :key="s.id">
            <td>{{ s.name }}</td><td>{{ s.email }}</td><td>{{ s.contact || '-' }}</td>
            <td>{{ s.assigned_trek_count }}</td>
            <td><span :class="s.is_active ? 'badge badge-open' : 'badge badge-cancelled'">{{ s.is_active ? 'Active' : 'Inactive' }}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-secondary me-1" @click="openEdit(s)"><i class="bi bi-pencil"></i> Edit</button>
              <button class="btn btn-sm" :class="s.is_active ? 'btn-outline-danger' : 'btn-outline-success'" @click="toggle(s)">{{ s.is_active ? 'Deactivate' : 'Activate' }}</button>
            </td>
          </tr>
          <tr v-if="!filtered.length"><td colspan="6" class="text-muted text-center">No staff found</td></tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal d-block" style="background:rgba(0,0,0,.5)">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Create New Trekking Staff</h5><button class="btn-close" @click="showModal=false"></button></div>
        <div class="modal-body">
          <div v-if="formError" class="alert alert-danger py-2">{{ formError }}</div>
          <div class="mb-2"><label class="form-label">Full Name</label><input class="form-control" v-model="form.name"></div>
          <div class="mb-2"><label class="form-label">Email Address</label><input class="form-control" v-model="form.email"></div>
          <div class="mb-2"><label class="form-label">Contact Number</label>
            <input class="form-control" v-model="form.contact" placeholder="10 digit number" maxlength="10" pattern="[0-9]{10}" inputmode="numeric" required></div>
          <div class="mb-2"><label class="form-label">Password</label><input type="password" class="form-control" v-model="form.password"></div>
          <div class="alert alert-info small">The staff member will receive these login credentials from you directly.</div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" @click="showModal=false">Cancel</button><button class="btn btn-brand" @click="save">Create Staff</button></div>
      </div></div>
    </div>

    <div v-if="showEditModal" class="modal d-block" style="background:rgba(0,0,0,.5)">
      <div class="modal-dialog"><div class="modal-content">
        <div class="modal-header"><h5 class="modal-title">Edit Staff — {{ editing.name }}</h5><button class="btn-close" @click="showEditModal=false"></button></div>
        <div class="modal-body">
          <div v-if="editError" class="alert alert-danger py-2">{{ editError }}</div>
          <div class="mb-2"><label class="form-label">Full Name</label><input class="form-control" v-model="editForm.name"></div>
          <div class="mb-2"><label class="form-label">Email Address</label><input class="form-control" :value="editing.email" disabled></div>
          <div class="mb-2"><label class="form-label">Contact Number</label>
            <input class="form-control" v-model="editForm.contact" placeholder="10 digit number" maxlength="10" pattern="[0-9]{10}" inputmode="numeric" required></div>
          <div class="alert alert-info small mb-0">Email cannot be changed. To reset a password, deactivate and re-create the staff member.</div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" @click="showEditModal=false">Cancel</button><button class="btn btn-brand" @click="saveEdit">Save Changes</button></div>
      </div></div>
    </div>
  </div>`,
  data() {
    return {
      staff: [], q: "", showModal: false, showEditModal: false, formError: "", editError: "",
      form: { name: "", email: "", contact: "", password: "" },
      editing: null, editForm: { name: "", contact: "" },
    };
  },
  computed: {
    filtered() { const q = this.q.toLowerCase(); return this.staff.filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)); },
  },
  mounted() { this.load(); },
  methods: {
    async load() { const { data } = await api.get("/admin/staff"); this.staff = data; },
    openCreate() { this.showModal = true; this.formError = ""; this.form = { name: "", email: "", contact: "", password: "" }; },
    async save() {
      this.formError = "";
      if (!/^[0-9]{10}$/.test(this.form.contact || "")) { this.formError = "Contact number must be exactly 10 digits"; return; }
      try {
        await api.post("/admin/staff", this.form);
        this.showModal = false; toast("Staff created"); this.load();
      } catch (err) { this.formError = apiError(err, "Could not create staff"); }
    },
    async toggle(s) { await api.put(`/admin/staff/${s.id}`, { is_active: !s.is_active }); this.load(); },
    openEdit(s) { this.editing = s; this.editForm = { name: s.name, contact: s.contact || "" }; this.editError = ""; this.showEditModal = true; },
    async saveEdit() {
      this.editError = "";
      if (!/^[0-9]{10}$/.test(this.editForm.contact || "")) { this.editError = "Contact number must be exactly 10 digits"; return; }
      try {
        await api.put(`/admin/staff/${this.editing.id}`, this.editForm);
        this.showEditModal = false; toast("Staff details updated"); this.load();
      } catch (err) { this.editError = apiError(err, "Could not update staff"); }
    },
  },
};

//Admin->Users
const AdminUsersPage = {
  template: `
  <div>
    <h3 class="mb-3">Users (Trekkers)</h3>
    <input class="form-control mb-3" style="max-width:300px" placeholder="Search users..." v-model="q">
    <div class="card stat-card p-3">
      <table class="table align-middle">
        <thead><tr><th>Name</th><th>Email</th><th>Contact</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          <tr v-for="u in filtered" :key="u.id">
            <td>{{ u.name }}</td><td>{{ u.email }}</td><td>{{ u.contact || '-' }}</td>
            <td>
              <span v-if="u.is_blacklisted" class="badge badge-cancelled">Blacklisted</span>
              <span v-else-if="!u.is_active" class="badge bg-secondary">Inactive</span>
              <span v-else class="badge badge-open">Active</span>
            </td>
            <td>
              <button v-if="u.is_blacklisted" class="btn btn-sm btn-outline-success" @click="act(u,'whitelist')">Whitelist</button>
              <button v-else class="btn btn-sm btn-outline-danger" @click="act(u,'blacklist')">Blacklist</button>
            </td>
          </tr>
          <tr v-if="!filtered.length"><td colspan="5" class="text-muted text-center">No users found</td></tr>
        </tbody>
      </table>
      <div class="alert alert-info small mt-2 mb-0">Blacklisted users cannot login or book treks.</div>
    </div>
  </div>`,
  data() { return { users: [], q: "" }; },
  computed: { filtered() { const q = this.q.toLowerCase(); return this.users.filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)); } },
  mounted() { this.load(); },
  methods: {
    async load() { const { data } = await api.get("/admin/users"); this.users = data; },
    async act(u, action) { await api.put(`/admin/users/${u.id}/status`, { action }); toast("Updated"); this.load(); },
  },
};

//Admin->Bookings
const AdminBookingsPage = {
  template: `
  <div>
    <h3 class="mb-3">All Bookings</h3>
    <div class="card stat-card p-3">
      <table class="table align-middle">
        <thead><tr><th>ID</th><th>User</th><th>Trek</th><th>Booking Date</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="b in bookings" :key="b.id">
            <td>{{ b.id }}</td><td>{{ b.user_name }}</td><td>{{ b.trek_name }}</td><td>{{ fmtDate(b.booking_date) }}</td>
            <td><span :class="statusBadgeClass(b.status)">{{ b.status }}</span></td>
          </tr>
          <tr v-if="!bookings.length"><td colspan="5" class="text-muted text-center">No bookings yet</td></tr>
        </tbody>
      </table>
    </div>
  </div>`,
  data() { return { bookings: [] }; },
  mounted() { this.load(); },
  methods: { fmtDate, statusBadgeClass, async load() { const { data } = await api.get("/admin/bookings"); this.bookings = data; } },
};

//Admin->Search
const AdminSearchPage = {
  template: `
  <div>
    <h3 class="mb-3">Search</h3>
    <div class="d-flex gap-2 mb-2 flex-wrap">
      <select class="form-select" style="max-width:180px" v-model="type"><option value="treks">Treks</option><option value="staff">Staff</option><option value="users">Users</option></select>
      <input class="form-control" style="max-width:260px" placeholder="Search..." v-model="q" @keyup.enter="search">
      <select v-if="type==='treks'" class="form-select" style="max-width:160px" v-model="status"><option value="">Status: All</option><option>Open</option><option>Closed</option><option>Completed</option></select>
      <input v-if="type==='treks'" class="form-control" style="max-width:200px" placeholder="Filter by location..." v-model="location">
      <button class="btn btn-brand" @click="search"><i class="bi bi-search"></i> Search</button>
    </div>
    <div class="card stat-card p-3">
      <table class="table align-middle" v-if="type!=='treks'">
        <thead><tr><th>Name</th><th>Email</th><th>Contact</th></tr></thead>
        <tbody><tr v-for="r in results" :key="r.id"><td>{{ r.name }}</td><td>{{ r.email }}</td><td>{{ r.contact || '-' }}</td></tr></tbody>
      </table>
      <table class="table align-middle" v-else>
        <thead><tr><th>Name</th><th>Location</th><th>Difficulty</th><th>Status</th></tr></thead>
        <tbody><tr v-for="r in results" :key="r.id"><td>{{ r.name }}</td><td>{{ r.location }}</td><td>{{ r.difficulty }}</td><td><span :class="statusBadgeClass(r.status)">{{ r.status }}</span></td></tr></tbody>
      </table>
      <div v-if="searched && !results.length" class="text-muted text-center py-3">No results found</div>
    </div>
  </div>`,
  data() { return { type: "treks", q: "", status: "", location: "", results: [], searched: false }; },
  methods: {
    statusBadgeClass,
    async search() {
      const params = { q: this.q, type: this.type };
      if (this.type === "treks") {
        if (this.status) params.status = this.status;
        if (this.location) params.location = this.location;
      }
      const { data } = await api.get("/admin/search", { params });
      this.results = data; this.searched = true;
    },
  },
};

//Admin->Reports
const AdminReportsPage = {
  template: `
  <div>
    <h3 class="mb-3">Reports &amp; Statistics</h3>
    <div class="row g-3 mb-3">
      <div class="col-md-4"><div class="card stat-card p-3"><div class="text-muted small">Completed Treks</div><div class="fs-3 fw-bold brand-color">{{ r.total_completed_treks ?? '-' }}</div></div></div>
      <div class="col-md-4"><div class="card stat-card p-3"><div class="text-muted small">Active Bookings</div><div class="fs-3 fw-bold brand-color">{{ r.total_active_bookings ?? '-' }}</div></div></div>
    </div>
    <div class="card stat-card p-3">
      <h6 class="fw-bold">Most Popular Treks</h6>
      <table class="table table-sm"><thead><tr><th>Trek</th><th>Bookings</th></tr></thead>
        <tbody><tr v-for="t in r.top_treks" :key="t.name"><td>{{ t.name }}</td><td>{{ t.bookings }}</td></tr>
          <tr v-if="!r.top_treks || !r.top_treks.length"><td colspan="2" class="text-muted text-center">No data yet</td></tr></tbody></table>
    </div>
    <div class="alert alert-info small mt-3">A full monthly activity report is automatically emailed to the Admin on the 1st of every month via a scheduled Celery job.</div>
  </div>`,
  data() { return { r: {} }; },
  mounted() { this.load(); },
  methods: { async load() { const { data } = await api.get("/admin/reports/monthly"); this.r = data; } },
};

//STAFF

//Staff->Dashboard
const StaffDashboardPage = {
  template: `
  <div>
    <h3 class="mb-4">My Dashboard</h3>
    <div class="row g-3 mb-4">
      <div class="col-md-4"><div class="card stat-card p-3"><div class="text-muted small">Assigned Treks</div><div class="fs-3 fw-bold brand-color">{{ treks.length }}</div></div></div>
      <div class="col-md-4"><div class="card stat-card p-3"><div class="text-muted small">Total Participants</div><div class="fs-3 fw-bold brand-color">{{ totalParticipants }}</div></div></div>
      <div class="col-md-4"><div class="card stat-card p-3"><div class="text-muted small">Ongoing Treks</div><div class="fs-3 fw-bold brand-color">{{ ongoing }}</div></div></div>
    </div>
    <div class="card stat-card p-3">
      <div class="d-flex justify-content-between align-items-center">
        <h6 class="fw-bold mb-0">My Assigned Treks</h6>
        <button v-if="treks.length > 5" class="btn btn-sm btn-outline-secondary" @click="go('staff-treks')">View All ({{ treks.length }})</button>
      </div>
      <table class="table align-middle">
        <thead><tr><th>Trek</th><th>Dates</th><th>Participants</th><th>Slots</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="t in treks.slice(0,5)" :key="t.id">
            <td>{{ t.name }}</td><td>{{ fmtDate(t.start_date) }} — {{ fmtDate(t.end_date) }}</td>
            <td>{{ t.participant_count }}</td><td>{{ t.available_slots }}/{{ t.total_slots }}</td>
            <td><span :class="statusBadgeClass(t.status)">{{ t.status }}</span></td>
            <td><button class="btn btn-sm btn-brand" @click="go('staff-trek-detail', t.id)">Manage</button></td>
          </tr>
          <tr v-if="!treks.length"><td colspan="6" class="text-muted text-center">No treks assigned yet</td></tr>
        </tbody>
      </table>
    </div>
  </div>`,
  data() { return { treks: [] }; },
  computed: {
    totalParticipants() { return this.treks.reduce((s, t) => s + t.participant_count, 0); },
    ongoing() { return this.treks.filter((t) => t.status === "Open").length; },
  },
  mounted() { this.load(); },
  methods: { go, fmtDate, statusBadgeClass, async load() { const { data } = await api.get("/staff/treks"); this.treks = data; } },
};

//Staff->Treks
const StaffTreksPage = {
  template: `
  <div>
    <h3 class="mb-3">My Treks</h3>
    <input class="form-control mb-3" style="max-width:300px" placeholder="Search my treks..." v-model="q">
    <div class="card stat-card p-3">
      <table class="table align-middle">
        <thead><tr><th>Trek</th><th>Location</th><th>Duration</th><th>Participants</th><th>Slots</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="t in filtered" :key="t.id">
            <td>{{ t.name }}</td><td>{{ t.location }}</td><td>{{ t.duration_days }} days</td>
            <td>{{ t.participant_count }}</td><td>{{ t.available_slots }}/{{ t.total_slots }}</td>
            <td><span :class="statusBadgeClass(t.status)">{{ t.status }}</span></td>
            <td><button class="btn btn-sm btn-brand" @click="go('staff-trek-detail', t.id)">Manage</button></td>
          </tr>
          <tr v-if="!filtered.length"><td colspan="7" class="text-muted text-center">No treks found</td></tr>
        </tbody>
      </table>
    </div>
  </div>`,
  data() { return { treks: [], q: "" }; },
  computed: {
    filtered() {
      const q = this.q.toLowerCase();
      return this.treks.filter((t) => !q || t.name.toLowerCase().includes(q) || t.location.toLowerCase().includes(q));
    },
  },
  mounted() { this.load(); },
  methods: { go, statusBadgeClass, async load() { const { data } = await api.get("/staff/treks"); this.treks = data; } },
};

//Staff->TrekDetail
const StaffTrekDetailPage = {
  template: `
  <div v-if="trek">
    <button class="btn btn-sm btn-outline-secondary mb-3" @click="go('staff-treks')"><i class="bi bi-arrow-left"></i> Back to My Treks</button>
    <div class="row g-3">
      <div class="col-md-5">
        <div class="card stat-card p-3">
          <h5>{{ trek.name }}</h5>
          <p class="text-muted mb-1">{{ trek.location }} · {{ trek.difficulty }} · {{ trek.duration_days }} days</p>
          <p class="small mb-1">Start: {{ fmtDate(trek.start_date) }} — End: {{ fmtDate(trek.end_date) }}</p>
          <p class="small">{{ trek.description }}</p>
          <hr>
          <div class="mb-2"><label class="form-label">Total Slots</label>
            <input type="number" min="0" class="form-control" v-model.number="totalSlots"></div>
          <div class="mb-2"><label class="form-label">Status</label>
            <select class="form-select" v-model="status"><option>Open</option><option>Closed</option></select></div>
          <button class="btn btn-brand w-100 mb-2" @click="update">Update Trek</button>
          <button class="btn btn-outline-success w-100" :disabled="trek.status==='Completed'" @click="complete">Mark as Completed</button>
        </div>
      </div>
      <div class="col-md-7">
        <div class="card stat-card p-3">
          <h6 class="fw-bold">Participants ({{ participants.length }})</h6>
          <table class="table table-sm">
            <thead><tr><th>Name</th><th>Email</th><th>Booking Date</th><th>Status</th></tr></thead>
            <tbody>
              <tr v-for="p in participants" :key="p.id">
                <td>{{ p.user_name }}</td><td>{{ p.user_email }}</td><td>{{ fmtDate(p.booking_date) }}</td>
                <td><span :class="statusBadgeClass(p.status)">{{ p.status }}</span></td>
              </tr>
              <tr v-if="!participants.length"><td colspan="4" class="text-muted text-center">No participants yet</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>`,
  data() { return { trek: null, participants: [], totalSlots: 0, status: "Open" }; },
  mounted() { this.load(); },
  methods: {
    go, fmtDate, statusBadgeClass,
    async load() {
      const tid = store.detailId;
      const [tr, pr] = await Promise.all([api.get(`/treks/${tid}`), api.get(`/staff/treks/${tid}/participants`)]);
      this.trek = tr.data; this.participants = pr.data;
      this.totalSlots = tr.data.total_slots; this.status = tr.data.status === "Completed" ? "Closed" : tr.data.status;
    },
    async update() {
      try {
        const { data } = await api.put(`/staff/treks/${store.detailId}`, { total_slots: this.totalSlots, status: this.status });
        this.trek = data; toast("Trek updated");
      } catch (err) { toast(apiError(err, "Update failed"), "danger"); }
    },
    async complete() {
      if (!confirm("Mark this trek as completed? This closes it for good.")) return;
      const { data } = await api.put(`/staff/treks/${store.detailId}/complete`);
      this.trek = data; toast("Trek marked completed");
    },
  },
};

//Staff->Profile
const StaffProfilePage = {
  template: `
  <div style="max-width:500px">
    <h3 class="mb-3">My Profile</h3>
    <div class="card stat-card p-3 mb-3">
      <div class="mb-2"><label class="form-label">Name</label><input class="form-control" :value="store.user.name" disabled></div>
      <div class="mb-2"><label class="form-label">Email</label><input class="form-control" :value="store.user.email" disabled></div>
      <div class="alert alert-info small mb-0">Contact your Admin to update staff profile details.</div>
    </div>
    <div class="card stat-card p-3">
      <h6 class="fw-bold">Change Password</h6>
      <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
      <div class="mb-2"><input type="password" class="form-control" placeholder="Current password" v-model="cur"></div>
      <div class="mb-2"><input type="password" class="form-control" placeholder="New password" v-model="np"></div>
      <div class="mb-2"><input type="password" class="form-control" placeholder="Confirm new password" v-model="cf"></div>
      <button class="btn btn-brand" @click="change">Update Password</button>
    </div>
  </div>`,
  data() { return { store, cur: "", np: "", cf: "", error: "" }; },
  methods: {
    async change() {
      this.error = "";
      try { await api.post("/change-password", { current_password: this.cur, new_password: this.np, confirm_password: this.cf }); toast("Password changed"); this.cur = this.np = this.cf = ""; }
      catch (err) { this.error = apiError(err, "Could not change password"); }
    },
  },
};

//USER

//User->Dashboard

const UserDashboardPage = {
  template: `
  <div>
    <h3 class="mb-1">Welcome, {{ store.user.name }}!</h3>
    <p class="text-muted mb-4">Here's what's happening with your treks.</p>
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="fw-bold mb-0">Recent Treks</h6>
      <button class="btn btn-sm btn-brand" @click="go('user-browse')">Browse Treks</button>
    </div>
    <div class="row g-3 mb-4">
      <div class="col-md-4" v-for="t in treks" :key="t.id">
        <div class="card trek-card stat-card p-3 h-100">
          <h6>{{ t.name }}</h6><p class="text-muted small mb-1">{{ t.location }} · {{ t.difficulty }} · {{ t.duration_days }} days</p>
          <p class="small mb-2">Slots left: {{ t.available_slots }}</p>
          <button class="btn btn-sm btn-brand mt-auto" @click="go('user-trek-detail', t.id)">View Details</button>
        </div>
      </div>
      <div v-if="!treks.length" class="text-muted">No treks available right now.</div>
    </div>
    <div class="d-flex justify-content-between align-items-center">
      <h6 class="fw-bold mb-0">Recent Bookings</h6>
      <a href="#" @click.prevent="go('user-bookings')">View All Bookings &rarr;</a>
    </div>
    <table class="table align-middle mt-2">
      <thead><tr><th>Trek</th><th>Booking Date</th><th>Status</th></tr></thead>
      <tbody>
        <tr v-for="b in bookings" :key="b.id"><td>{{ b.trek_name }}</td><td>{{ fmtDate(b.booking_date) }}</td><td><span :class="statusBadgeClass(b.status)">{{ b.status }}</span></td></tr>
        <tr v-if="!bookings.length"><td colspan="3" class="text-muted text-center">No bookings yet</td></tr>
      </tbody>
    </table>
  </div>`,
  data() { return { store, treks: [], bookings: [] }; },
  mounted() { this.load(); },
  methods: {
    go, fmtDate, statusBadgeClass,
    async load() {
      // Loaded independently so a failure on one call never blanks the other.
      try { const { data } = await api.get("/treks"); this.treks = data.slice(0, 3); }
      catch (err) { console.error("Failed to load treks", err); }
      try { const { data } = await api.get("/bookings/my"); this.bookings = data.slice(0, 5); }
      catch (err) { console.error("Failed to load bookings", err); }
    },
  },
};

//User->BrowseTreks
const UserBrowsePage = {
  template: `
  <div>
    <h3 class="mb-3">Browse Treks</h3>
    <div class="d-flex gap-2 mb-3">
      <input class="form-control" placeholder="Search location..." v-model="filters.location" @change="load">
      <select class="form-select" style="max-width:160px" v-model="filters.difficulty" @change="load"><option value="">Difficulty: All</option><option>Easy</option><option>Moderate</option><option>Hard</option></select>
      <select class="form-select" style="max-width:160px" v-model="filters.duration" @change="load"><option value="">Max Duration</option><option value="5">≤ 5 days</option><option value="10">≤ 10 days</option><option value="20">≤ 20 days</option></select>
    </div>
    <div class="row g-3">
      <div class="col-md-4" v-for="t in treks" :key="t.id">
        <div class="card trek-card stat-card p-3 h-100 d-flex flex-column">
          <h6>{{ t.name }}</h6>
          <p class="text-muted small mb-1">{{ t.location }}</p>
          <p class="small mb-1">{{ t.difficulty }} · {{ t.duration_days }} days</p>
          <p class="small mb-2">Slots left: {{ t.available_slots }}</p>
          <button class="btn btn-sm btn-brand mt-auto" @click="go('user-trek-detail', t.id)" :disabled="t.available_slots<=0">
            {{ t.available_slots<=0 ? 'Not Available' : 'View Details' }}</button>
        </div>
      </div>
      <div v-if="!treks.length" class="text-muted">No treks match your filters.</div>
    </div>
  </div>`,
  data() { return { treks: [], filters: { location: "", difficulty: "", duration: "" } }; },
  mounted() { this.load(); },
  methods: {
    go,
    async load() {
      const params = {};
      if (this.filters.location) params.location = this.filters.location;
      if (this.filters.difficulty) params.difficulty = this.filters.difficulty;
      if (this.filters.duration) params.duration = this.filters.duration;
      const { data } = await api.get("/treks", { params });
      this.treks = data;
    },
  },
};

//User->TrekDetail
const UserTrekDetailPage = {
  template: `
  <div v-if="trek" style="max-width:600px">
    <button class="btn btn-sm btn-outline-secondary mb-3" @click="go('user-browse')"><i class="bi bi-arrow-left"></i> Back</button>
    <div class="card stat-card p-4">
      <h4>{{ trek.name }}</h4>
      <p class="text-muted">{{ trek.location }}</p>
      <p><span class="badge bg-secondary me-1">{{ trek.difficulty }}</span><span class="badge bg-secondary me-1">{{ trek.duration_days }} days</span><span :class="statusBadgeClass(trek.status)">{{ trek.status }}</span></p>
      <p>{{ trek.description }}</p>
      <p class="small">Dates: {{ fmtDate(trek.start_date) }} — {{ fmtDate(trek.end_date) }}</p>
      <p class="small">Slots left: {{ trek.available_slots }} / {{ trek.total_slots }}</p>
      <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

      <div v-if="myBooking">
        <div class="alert alert-success py-2"><i class="bi bi-check-circle"></i> You have already booked this trek.</div>
        <button class="btn btn-outline-danger" @click="cancel">Cancel Booking</button>
      </div>
      <button v-else class="btn btn-brand" :disabled="trek.status!=='Open' || trek.available_slots<=0" @click="book">
        {{ trek.available_slots<=0 ? 'No Slots Available' : 'Book Now' }}</button>
    </div>
  </div>`,
  data() { return { trek: null, error: "", myBooking: null }; },
  mounted() { this.load(); },
  methods: {
    go, fmtDate, statusBadgeClass,
    async load() {
      const [tr, br] = await Promise.all([api.get(`/treks/${store.detailId}`), api.get("/bookings/my")]);
      this.trek = tr.data;
      this.myBooking = br.data.find((b) => b.trek_id === tr.data.id) || null;
    },
    async book() {
      this.error = "";
      try { await api.post("/bookings", { trek_id: this.trek.id }); toast("Trek booked!"); go("user-bookings"); }
      catch (err) { this.error = apiError(err, "Booking failed"); }
    },
    async cancel() {
      if (!confirm(`Cancel your booking for "${this.trek.name}"?`)) return;
      await api.put(`/bookings/${this.myBooking.id}/cancel`);
      toast("Booking cancelled"); this.load();
    },
  },
};

//User->Bookings
const UserBookingsPage = {
  template: `
  <div>
    <h3 class="mb-3">My Bookings</h3>
    <div class="card stat-card p-3">
      <table class="table align-middle">
        <thead><tr><th>Trek</th><th>Dates</th><th>Booking Date</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="b in bookings" :key="b.id">
            <td>{{ b.trek_name }}</td><td>{{ fmtDate(b.trek_start_date) }} — {{ fmtDate(b.trek_end_date) }}</td>
            <td>{{ fmtDate(b.booking_date) }}</td>
            <td><span :class="statusBadgeClass(b.status)">{{ b.status }}</span></td>
            <td><button class="btn btn-sm btn-outline-danger" @click="cancel(b)">Cancel</button></td>
          </tr>
          <tr v-if="!bookings.length"><td colspan="5" class="text-muted text-center">No active bookings</td></tr>
        </tbody>
      </table>
    </div>
  </div>`,
  data() { return { bookings: [] }; },
  mounted() { this.load(); },
  methods: {
    fmtDate, statusBadgeClass,
    async load() { const { data } = await api.get("/bookings/my"); this.bookings = data; },
    async cancel(b) {
      if (!confirm(`Cancel your booking for "${b.trek_name}"?`)) return;
      await api.put(`/bookings/${b.id}/cancel`); toast("Booking cancelled"); this.load();
    },
  },
};


//User->History
const UserHistoryPage = {
  template: `
  <div>
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h3>Trekking History</h3>
      <button class="btn btn-brand" @click="exportCsv" :disabled="exporting"><i class="bi bi-download"></i> {{ exporting ? 'Preparing...' : 'Export CSV' }}</button>
    </div>
    <div class="card stat-card p-3">
      <table class="table align-middle">
        <thead><tr><th>Trek</th><th>Trek Dates</th><th>Booking Date</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="b in history" :key="b.id">
            <td>{{ b.trek_name }}</td><td>{{ fmtDate(b.trek_start_date) }} — {{ fmtDate(b.trek_end_date) }}</td>
            <td>{{ fmtDate(b.booking_date) }}</td><td><span :class="statusBadgeClass(b.status)">{{ b.status }}</span></td>
          </tr>
          <tr v-if="!history.length"><td colspan="4" class="text-muted text-center">History shows all your completed and cancelled treks.</td></tr>
        </tbody>
      </table>
    </div>
  </div>`,
  data() { return { history: [], exporting: false }; },
  mounted() { this.load(); },
  methods: {
    fmtDate, statusBadgeClass,
    async load() { const { data } = await api.get("/bookings/history"); this.history = data; },
    async exportCsv() {
      this.exporting = true;
      try {
        const { data } = await api.post("/bookings/export");
        const taskId = data.task_id;
        toast("Export started — preparing your file...");
        const poll = async () => {
          const { data: s } = await api.get(`/bookings/export/status/${taskId}`);
          if (s.status === "done") {
            const res = await api.get(`/bookings/export/download/${taskId}`, { responseType: "blob" });
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement("a");
            a.href = url; a.download = "booking_history.csv"; document.body.appendChild(a); a.click(); a.remove();
            toast("CSV downloaded");
            this.exporting = false;
          } else { setTimeout(poll, 1500); }
        };
        poll();
      } catch (err) { toast(apiError(err, "Export failed"), "danger"); this.exporting = false; }
    },
  },
};


//User->Profile
const UserProfilePage = {
  template: `
  <div style="max-width:500px">
    <h3 class="mb-3">My Profile</h3>
    <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
    <div class="card stat-card p-3 mb-3">
      <div class="mb-2"><label class="form-label">Name</label><input class="form-control" v-model="form.name"></div>
      <div class="mb-2"><label class="form-label">Email</label><input class="form-control" :value="store.user.email" disabled></div>
      <div class="mb-2"><label class="form-label">Contact Number</label>
        <input class="form-control" v-model="form.contact" placeholder="10 digit number" maxlength="10" pattern="[0-9]{10}" inputmode="numeric" required></div>
      <button class="btn btn-brand" @click="save">Save Changes</button>
    </div>
    <div class="card stat-card p-3">
      <h6 class="fw-bold">Change Password</h6>
      <div v-if="pwError" class="alert alert-danger py-2">{{ pwError }}</div>
      <div class="mb-2"><input type="password" class="form-control" placeholder="Current password" v-model="cur"></div>
      <div class="mb-2"><input type="password" class="form-control" placeholder="New password" v-model="np"></div>
      <div class="mb-2"><input type="password" class="form-control" placeholder="Confirm new password" v-model="cf"></div>
      <button class="btn btn-brand" @click="changePw">Update Password</button>
    </div>
  </div>`,
  data() { return { store, form: { name: store.user.name, contact: store.user.contact || "" }, error: "", cur: "", np: "", cf: "", pwError: "" }; },
  methods: {
    async save() {
      this.error = "";
      if (!/^[0-9]{10}$/.test(this.form.contact || "")) { this.error = "Contact number is required and must be exactly 10 digits"; return; }
      try {
        const { data } = await api.put("/profile", this.form);
        store.user = data; localStorage.setItem("tma_user", JSON.stringify(data));
        toast("Profile updated");
      } catch (err) { this.error = apiError(err, "Update failed"); }
    },
    async changePw() {
      this.pwError = "";
      try { await api.post("/change-password", { current_password: this.cur, new_password: this.np, confirm_password: this.cf }); toast("Password changed"); this.cur = this.np = this.cf = ""; }
      catch (err) { this.pwError = apiError(err, "Could not change password"); }
    },
  },
};

//MAIN APP CODE

const App = {
  template: `
  <div>
    <div v-if="!store.user">
      <login-page v-if="store.page==='login'"></login-page>
      <register-page v-else></register-page>
    </div>
    <div v-else class="d-flex flex-column min-vh-100">
      <app-navbar></app-navbar>
      <div class="d-flex flex-grow-1">
        <admin-sidebar v-if="store.user.role==='admin'"></admin-sidebar>
        <staff-sidebar v-else-if="store.user.role==='staff'"></staff-sidebar>
        <user-sidebar v-else></user-sidebar>
        <div class="flex-grow-1 p-4">
          <component :is="pageComponent"></component>
        </div>
      </div>
    </div>
    <div v-if="store.toast" class="position-fixed bottom-0 end-0 p-3" style="z-index:2000">
      <div class="toast show text-white" :class="store.toast.type==='danger' ? 'bg-danger' : 'bg-success'">
        <div class="toast-body">{{ store.toast.msg }}</div>
      </div>
    </div>
  </div>`,
  data() { return { store }; },
  computed: { pageComponent() { return store.page + "-page"; } },
  mounted() { if (store.user) routeHome(); },
};

const app = Vue.createApp(App);
app.component("app-navbar", AppNavbar);
app.component("admin-sidebar", AdminSidebar);
app.component("staff-sidebar", StaffSidebar);
app.component("user-sidebar", UserSidebar);
app.component("login-page", LoginPage);
app.component("register-page", RegisterPage);
app.component("admin-dashboard-page", AdminDashboardPage);
app.component("admin-treks-page", AdminTreksPage);
app.component("admin-staff-page", AdminStaffPage);
app.component("admin-users-page", AdminUsersPage);
app.component("admin-bookings-page", AdminBookingsPage);
app.component("admin-search-page", AdminSearchPage);
app.component("admin-reports-page", AdminReportsPage);
app.component("admin-profile-page", StaffProfilePage); 
app.component("staff-dashboard-page", StaffDashboardPage);
app.component("staff-treks-page", StaffTreksPage);
app.component("staff-trek-detail-page", StaffTrekDetailPage);
app.component("staff-profile-page", StaffProfilePage);
app.component("user-dashboard-page", UserDashboardPage);
app.component("user-browse-page", UserBrowsePage);
app.component("user-trek-detail-page", UserTrekDetailPage);
app.component("user-bookings-page", UserBookingsPage);
app.component("user-history-page", UserHistoryPage);
app.component("user-profile-page", UserProfilePage);
app.mount("#app");
