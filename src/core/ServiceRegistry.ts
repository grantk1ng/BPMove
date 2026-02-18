const services = new Map<string, unknown>();

export const ServiceRegistry = {
  register<T>(name: string, service: T): void {
    services.set(name, service);
  },

  get<T>(name: string): T {
    const service = services.get(name);
    if (!service) {
      throw new Error(`Service "${name}" not registered`);
    }
    return service as T;
  },

  has(name: string): boolean {
    return services.has(name);
  },

  clear(): void {
    services.clear();
  },
};
