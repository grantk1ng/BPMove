import type {EventMap} from './EventBus.types';

type EventHandler<T> = (data: T) => void;

class TypedEventBus {
  private listeners = new Map<string, Set<EventHandler<any>>>();

  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
  ): () => void {
    if (!this.listeners.has(event as string)) {
      this.listeners.set(event as string, new Set());
    }
    this.listeners.get(event as string)!.add(handler);

    return () => {
      this.listeners.get(event as string)?.delete(handler);
    };
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    this.listeners.get(event as string)?.forEach(handler => handler(data));
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }
}

export const eventBus = new TypedEventBus();
export type {TypedEventBus};
