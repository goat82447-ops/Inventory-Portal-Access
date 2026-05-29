import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Product = {
  id: number;
  name: string;
  description: string;
  sku: string;
  category: string;
  price: number;
  quantity: number;
  isActive: boolean;
  imageUrl?: string | null;
  createdAtUtc?: string | null;
  updatedAtUtc?: string | null;
};

type AuthResponse = {
  token: string;
  expiresAtUtc: string;
  username: string;
  email: string;
};

type ProductForm = {
  name: string;
  description: string;
  sku: string;
  category: string;
  price: number;
  quantity: number;
  isActive: boolean;
  removeImage: boolean;
};

type SortKey = 'name' | 'category' | 'price' | 'quantity' | 'updatedAtUtc';

const PAGE_SIZE_OPTIONS = [5, 10, 20];

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:5121/api/products';
  private readonly apiHost = 'http://localhost:5121';
  private readonly authUrl = 'http://localhost:5121/api/auth';
  private readonly tokenStorageKey = 'curdapp_jwt';

  protected readonly title = signal('Inventory Control Center');
  protected readonly products = signal<Product[]>([]);
  protected readonly isEditing = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly loading = signal(false);

  protected readonly authMode = signal<'login' | 'register'>('login');
  protected readonly authToken = signal(localStorage.getItem(this.tokenStorageKey) ?? '');
  protected readonly authUsername = signal(localStorage.getItem('curdapp_username') ?? '');
  protected readonly authEmail = signal(localStorage.getItem('curdapp_email') ?? '');
  protected readonly authMessage = signal('');

  protected readonly search = signal('');
  protected readonly categoryFilter = signal('all');
  protected readonly statusFilter = signal<'all' | 'active' | 'inactive'>('all');
  protected readonly sortKey = signal<SortKey>('updatedAtUtc');
  protected readonly sortDirection = signal<'asc' | 'desc'>('desc');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(10);

  protected selectedImage: File | null = null;
  protected imagePreview = signal<string | null>(null);
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  protected readonly authForm = signal({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    usernameOrEmail: ''
  });

  protected readonly isAuthenticated = computed(() => this.authToken().length > 0);

  protected readonly form = signal<ProductForm>({
    name: '',
    description: '',
    sku: '',
    category: '',
    price: 0,
    quantity: 0,
    isActive: true,
    removeImage: false
  });

  protected readonly categories = computed(() => {
    const values = new Set(this.products().map((item) => item.category).filter((category) => category.trim().length > 0));
    return ['all', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  });

  protected readonly visibleProducts = computed(() => {
    const searchTerm = this.search().trim().toLowerCase();
    const categoryFilter = this.categoryFilter();
    const statusFilter = this.statusFilter();

    const filtered = this.products().filter((product) => {
      const matchesSearch =
        searchTerm.length === 0 ||
        product.name.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm) ||
        product.sku.toLowerCase().includes(searchTerm);

      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && product.isActive) ||
        (statusFilter === 'inactive' && !product.isActive);

      return matchesSearch && matchesCategory && matchesStatus;
    });

    const sorted = [...filtered].sort((left, right) => {
      const key = this.sortKey();
      const direction = this.sortDirection() === 'asc' ? 1 : -1;

      const leftValue = this.sortValue(left, key);
      const rightValue = this.sortValue(right, key);

      if (leftValue < rightValue) {
        return -1 * direction;
      }

      if (leftValue > rightValue) {
        return 1 * direction;
      }

      return 0;
    });

    return sorted;
  });

  protected readonly totalPages = computed(() => {
    const pages = Math.ceil(this.visibleProducts().length / this.pageSize());
    return pages > 0 ? pages : 1;
  });

  protected readonly pagedProducts = computed(() => {
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return this.visibleProducts().slice(start, start + size);
  });

  protected readonly totalInventoryValue = computed(() =>
    this.products().reduce((sum, item) => sum + item.price * item.quantity, 0));

  protected readonly lowStockCount = computed(() =>
    this.products().filter((item) => item.quantity <= 5).length);

  protected readonly activeCount = computed(() =>
    this.products().filter((item) => item.isActive).length);

  constructor() {
    if (this.isAuthenticated()) {
      this.loadProducts();
    }
  }

  protected loadProducts(): void {
    if (!this.isAuthenticated()) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.http.get<Product[]>(this.apiUrl, this.authOptions()).subscribe({
      next: (items) => {
        this.products.set(items);
        this.keepPageInRange();
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load products. Please login again if token is expired.');
        this.handleUnauthorized();
        this.loading.set(false);
      }
    });
  }

  protected saveProduct(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    const payload = this.form();

    if (!payload.name.trim()) {
      this.errorMessage.set('Product name is required.');
      return;
    }

    const formData = new FormData();
    formData.append('name', payload.name.trim());
    formData.append('description', payload.description.trim());
    formData.append('sku', payload.sku.trim());
    formData.append('category', payload.category.trim());
    formData.append('price', payload.price.toString());
    formData.append('quantity', payload.quantity.toString());
    formData.append('isActive', payload.isActive ? 'true' : 'false');
    formData.append('removeImage', payload.removeImage ? 'true' : 'false');

    if (this.selectedImage) {
      formData.append('image', this.selectedImage);
    }

    if (this.isEditing() && this.editingId() !== null) {
      this.http.put(`${this.apiUrl}/${this.editingId()}`, formData, this.authOptions()).subscribe({
        next: () => {
          this.successMessage.set('Product updated successfully.');
          this.resetForm();
          this.loadProducts();
        },
        error: () => {
          this.errorMessage.set('Unable to update product.');
          this.handleUnauthorized();
        }
      });
      return;
    }

    this.http.post<Product>(this.apiUrl, formData, this.authOptions()).subscribe({
      next: () => {
        this.successMessage.set('Product created successfully.');
        this.resetForm();
        this.currentPage.set(1);
        this.loadProducts();
      },
      error: () => {
        this.errorMessage.set('Unable to create product.');
        this.handleUnauthorized();
      }
    });
  }

  protected editProduct(product: Product): void {
    this.isEditing.set(true);
    this.editingId.set(product.id);
    this.form.set({
      name: product.name,
      description: product.description,
      sku: product.sku,
      category: product.category,
      price: product.price,
      quantity: product.quantity,
      isActive: product.isActive,
      removeImage: false
    });

    this.selectedImage = null;
    this.imagePreview.set(this.toImageUrl(product.imageUrl));
  }

  protected deleteProduct(id: number): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    this.http.delete(`${this.apiUrl}/${id}`, this.authOptions()).subscribe({
      next: () => {
        this.successMessage.set('Product deleted successfully.');
        this.loadProducts();
      },
      error: () => {
        this.errorMessage.set('Unable to delete product.');
        this.handleUnauthorized();
      }
    });
  }

  protected toggleProductStatus(product: Product): void {
    const isActive = !product.isActive;
    this.http.patch(`${this.apiUrl}/${product.id}/status?isActive=${isActive}`, {}, this.authOptions()).subscribe({
      next: () => this.loadProducts(),
      error: () => {
        this.errorMessage.set('Unable to change product status.');
        this.handleUnauthorized();
      }
    });
  }

  protected switchAuthMode(mode: 'login' | 'register'): void {
    this.authMode.set(mode);
    this.authMessage.set('');
    this.errorMessage.set('');
  }

  protected updateAuthUsername(value: string): void {
    this.authForm.update((f) => ({ ...f, username: value }));
  }

  protected updateAuthEmail(value: string): void {
    this.authForm.update((f) => ({ ...f, email: value }));
  }

  protected updateAuthPassword(value: string): void {
    this.authForm.update((f) => ({ ...f, password: value }));
  }

  protected updateConfirmPassword(value: string): void {
    this.authForm.update((f) => ({ ...f, confirmPassword: value }));
  }

  protected updateUsernameOrEmail(value: string): void {
    this.authForm.update((f) => ({ ...f, usernameOrEmail: value }));
  }

  protected register(): void {
    this.authMessage.set('');
    const form = this.authForm();

    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      this.authMessage.set('Username, email, and password are required.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      this.authMessage.set('Passwords do not match.');
      return;
    }

    this.http.post<AuthResponse>(`${this.authUrl}/register`, {
      username: form.username,
      email: form.email,
      password: form.password
    }).subscribe({
      next: (response) => {
        this.applyAuth(response);
        this.authMessage.set('Registration successful.');
        this.loadProducts();
      },
      error: (error) => {
        this.authMessage.set(error?.error ?? 'Registration failed.');
      }
    });
  }

  protected login(): void {
    this.authMessage.set('');
    const form = this.authForm();

    if (!form.usernameOrEmail.trim() || !form.password.trim()) {
      this.authMessage.set('Username/email and password are required.');
      return;
    }

    this.http.post<AuthResponse>(`${this.authUrl}/login`, {
      usernameOrEmail: form.usernameOrEmail,
      password: form.password
    }).subscribe({
      next: (response) => {
        this.applyAuth(response);
        this.authMessage.set('Login successful.');
        this.loadProducts();
      },
      error: () => {
        this.authMessage.set('Invalid credentials.');
      }
    });
  }

  protected logout(): void {
    this.authToken.set('');
    this.authUsername.set('');
    this.authEmail.set('');
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem('curdapp_username');
    localStorage.removeItem('curdapp_email');
    this.products.set([]);
    this.resetForm();
    this.errorMessage.set('');
    this.successMessage.set('');
    this.authMessage.set('Logged out successfully.');
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedImage = file;

    if (!file) {
      this.imagePreview.set(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => this.imagePreview.set(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);

    this.form.update((f) => ({ ...f, removeImage: false }));
  }

  protected markImageForRemoval(checked: boolean): void {
    this.form.update((f) => ({ ...f, removeImage: checked }));
    if (checked) {
      this.selectedImage = null;
      this.imagePreview.set(null);
    }
  }

  protected toImageUrl(path: string | null | undefined): string {
    if (!path) {
      return '';
    }

    return path.startsWith('http') ? path : `${this.apiHost}${path}`;
  }

  protected setSort(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }

    this.sortKey.set(key);
    this.sortDirection.set('asc');
  }

  protected setSearch(value: string): void {
    this.search.set(value);
    this.currentPage.set(1);
  }

  protected setCategoryFilter(value: string): void {
    this.categoryFilter.set(value);
    this.currentPage.set(1);
  }

  protected setStatusFilter(value: 'all' | 'active' | 'inactive'): void {
    this.statusFilter.set(value);
    this.currentPage.set(1);
  }

  protected setPageSize(value: number): void {
    this.pageSize.set(value);
    this.currentPage.set(1);
  }

  protected goToPreviousPage(): void {
    this.currentPage.update((page) => Math.max(1, page - 1));
  }

  protected goToNextPage(): void {
    this.currentPage.update((page) => Math.min(this.totalPages(), page + 1));
  }

  protected updateName(value: string): void {
    this.form.update((f) => ({ ...f, name: value }));
  }

  protected updateDescription(value: string): void {
    this.form.update((f) => ({ ...f, description: value }));
  }

  protected updateSku(value: string): void {
    this.form.update((f) => ({ ...f, sku: value }));
  }

  protected updateCategory(value: string): void {
    this.form.update((f) => ({ ...f, category: value }));
  }

  protected updatePrice(value: number): void {
    this.form.update((f) => ({ ...f, price: value }));
  }

  protected updateQuantity(value: number): void {
    this.form.update((f) => ({ ...f, quantity: value }));
  }

  protected updateIsActive(value: boolean): void {
    this.form.update((f) => ({ ...f, isActive: value }));
  }

  private resetForm(): void {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.selectedImage = null;
    this.imagePreview.set(null);
    this.form.set({
      name: '',
      description: '',
      sku: '',
      category: '',
      price: 0,
      quantity: 0,
      isActive: true,
      removeImage: false
    });
  }

  private authOptions(): { headers: HttpHeaders } {
    return {
      headers: new HttpHeaders({
        Authorization: `Bearer ${this.authToken()}`
      })
    };
  }

  private applyAuth(response: AuthResponse): void {
    this.authToken.set(response.token);
    this.authUsername.set(response.username);
    this.authEmail.set(response.email);
    localStorage.setItem(this.tokenStorageKey, response.token);
    localStorage.setItem('curdapp_username', response.username);
    localStorage.setItem('curdapp_email', response.email);

    this.authForm.update((f) => ({
      ...f,
      password: '',
      confirmPassword: '',
      usernameOrEmail: ''
    }));
  }

  private handleUnauthorized(): void {
    if (this.isAuthenticated()) {
      this.logout();
      this.authMessage.set('Session expired. Please login again.');
    }
  }

  private sortValue(product: Product, key: SortKey): string | number {
    if (key === 'price' || key === 'quantity') {
      return product[key] as number;
    }

    if (key === 'updatedAtUtc') {
      return product.updatedAtUtc ?? '';
    }

    return (product[key] as string).toLowerCase();
  }

  private keepPageInRange(): void {
    const totalPages = Math.ceil(this.visibleProducts().length / this.pageSize());
    const page = this.currentPage();

    if (totalPages === 0) {
      this.currentPage.set(1);
      return;
    }

    if (page > totalPages) {
      this.currentPage.set(totalPages);
    }
  }
}
