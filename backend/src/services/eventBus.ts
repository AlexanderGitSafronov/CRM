import { Response } from 'express';

const clients = new Set<Response>();

export function addSseClient(res: Response) {
  clients.add(res);
}

export function removeSseClient(res: Response) {
  clients.delete(res);
}

export function broadcastEvent(event: string, data: object = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((res) => {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  });
}
