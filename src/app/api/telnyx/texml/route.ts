export async function POST() {
  return new Response('<?xml version="1.0" encoding="UTF-8"?><Response><Hangup /></Response>', {
    headers: { 'Content-Type': 'application/xml' },
  });
}

export { POST as GET };
