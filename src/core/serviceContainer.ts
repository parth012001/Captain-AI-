/**
 * Service Container for Dependency Injection
 * Provides centralized access to all services
 */
import { ServiceRegistry } from '../types/services';

export class ServiceContainer {
  private static instance: ServiceContainer;
  private services: Map<string, any> = new Map();

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
    console.log(`🔧 [SERVICE CONTAINER] Registered service: ${name}`);
  }

  get<K extends keyof ServiceRegistry>(name: K): ServiceRegistry[K] {
    const service = this.services.get(name as string);
    if (!service) {
      throw new Error(`❌ [SERVICE CONTAINER] Service ${name as string} not registered`);
    }
    return service as ServiceRegistry[K];
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  getAllServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  clear(): void {
    console.log(`🧹 [SERVICE CONTAINER] Clearing all services`);
    this.services.clear();
  }
}

// Export singleton instance for convenience
export const serviceContainer = ServiceContainer.getInstance();