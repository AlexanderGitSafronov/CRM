import { Response } from 'express';

// Per-organization SSE clients
const clientsByOrg = new Map<string, Set<Response>>();

export function addSseClient(organizationId: string, res: Response) {
  let set = clientsByOrg.get(organizationId);
  if (!set) {
    set = new Set();
    clientsByOrg.set(organizationId, set);
  }
  set.add(res);
}

export function removeSseClient(organizationId: string, res: Response) {
  const set = clientsByOrg.get(organizationId);
  if (set) {
    set.delete(res);
    if (!set.size) clientsByOrg.delete(organizationId);
  }
}

export function broadcastEvent(organizationId: string, event: string, data: object = {}) {
  const set = clientsByOrg.get(organizationId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  set.forEach((res) => {
    try {
      res.write(payload);
    } catch {
      set.delete(res);
    }
  });
}
