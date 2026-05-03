import { EventEmitter } from "events";

export type AdminEvent =
  | { type: "order.changed"; orderId: string }
  | { type: "verification.changed"; orderId: string; verificationId: string }
  | { type: "job.changed"; jobId: string }
  | { type: "comment.added"; orderId: string };

const bus = new EventEmitter();
bus.setMaxListeners(200);

export function publish(event: AdminEvent): void {
  bus.emit("event", event);
}

export function subscribe(handler: (event: AdminEvent) => void): () => void {
  bus.on("event", handler);
  return () => bus.off("event", handler);
}
