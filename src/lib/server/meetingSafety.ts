import 'server-only';

import type { TranscriptTurn } from '@/lib/mockData';
import type { CallSummary } from '@/lib/server/aiSummaryService';

const SCHEDULING_SIGNAL = /\b(agend|reuni[oó]n|cita|calendario|meeting|schedule|confirm[oa]?)\w*/i;
const TIME_SIGNAL =
  /\b([01]?\d|2[0-3])[:.][0-5]\d\b|\ba\s+las\s+\w+|\b(mañana|pasado mañana|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo)\b/i;
const PROMPT_INJECTION_SIGNAL =
  /\b(ignore|ignora|omite|olvida)\b.{0,40}\b(instrucciones|instructions|sistema|system|prompt)\b/i;

export function approvedAutomatedMeetingDate(
  summary: CallSummary,
  transcript: TranscriptTurn[],
  now = new Date(),
) {
  if (!summary.interested || !summary.proposedDateTime) return null;

  const userText = transcript
    .filter((turn) => turn.role === 'user')
    .map((turn) => turn.text)
    .join(' ');
  if (
    PROMPT_INJECTION_SIGNAL.test(userText) ||
    !SCHEDULING_SIGNAL.test(userText) ||
    !TIME_SIGNAL.test(userText)
  ) {
    return null;
  }

  const proposed = new Date(summary.proposedDateTime);
  const earliest = now.getTime() + 5 * 60_000;
  const latest = now.getTime() + 180 * 24 * 60 * 60_000;
  if (
    !Number.isFinite(proposed.getTime()) ||
    proposed.getTime() < earliest ||
    proposed.getTime() > latest
  ) {
    return null;
  }

  return proposed.toISOString();
}
