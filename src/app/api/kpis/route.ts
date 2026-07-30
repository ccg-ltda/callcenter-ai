import { NextResponse } from 'next/server';
import { mockKpis } from '@/lib/mockData';
import { getSupabaseAdmin, useMockServices } from '@/lib/server/supabaseAdmin';
import { requireApiAuth } from '@/lib/server/routeSecurity';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(request: Request) {
  const authError = requireApiAuth(request);
  if (authError) return authError;
  if (useMockServices) return NextResponse.json(mockKpis);
  const supabase = getSupabaseAdmin();
  const [{ data: calls, error: callsError }, { data: transcripts }, { data: meetings }, { data: daily }] = await Promise.all([
    supabase!.from('calls').select('status, started_at, duration_seconds, cost_usd, outcome'),
    supabase!.from('transcripts').select('interested'),
    supabase!.from('meetings').select('id').eq('status', 'scheduled'),
    supabase!.from('daily_metrics').select('*').order('date'),
  ]);
  if (callsError) return NextResponse.json({ error: callsError.message }, { status: 500 });

  const allCalls = calls || [];
  const callsMade = allCalls.length;
  const callsAnswered = allCalls.filter((call: any) => call.duration_seconds > 0 || ['in_progress', 'completed'].includes(call.status)).length;
  const conversations = (transcripts || []).length;
  const meetingsBooked = (meetings || []).length;
  const minutesTalked = allCalls.reduce((sum: number, call: any) => sum + (call.duration_seconds || 0), 0) / 60;
  const totalCostUsd = allCalls.reduce((sum: number, call: any) => sum + (call.cost_usd || 0), 0);
  const summary = {
    callsMade, callsAnswered, conversations, meetingsBooked, minutesTalked, totalCostUsd,
    costPerMeeting: meetingsBooked ? totalCostUsd / meetingsBooked : 0,
    contactRate: callsMade ? (callsAnswered / callsMade) * 100 : 0,
    closeRate: callsAnswered ? (meetingsBooked / callsAnswered) * 100 : 0,
  };
  const outcomeCounts = new Map<string, number>();
  allCalls.forEach((call: any) => outcomeCounts.set(call.outcome || 'no_answer', (outcomeCounts.get(call.outcome || 'no_answer') || 0) + 1));
  const palette = ['#3b82f6', '#8b5cf6', '#3b82f6', '#52525b', '#f59e0b'];
  const outcomes = Array.from(outcomeCounts, ([name, value], index) => ({ name: name.replaceAll('_', ' '), value, color: palette[index % palette.length] }));
  const heatmap = Array.from({ length: 5 }, (_, day) => Array.from({ length: 9 }, (_, hour) => ({ day, hour: hour + 9, value: 0 }))).flat();
  allCalls.forEach((call: any) => {
    if (!call.started_at) return;
    const date = new Date(call.started_at); const day = date.getDay() - 1; const hour = date.getHours();
    const bucket = heatmap.find((item) => item.day === day && item.hour === hour); if (bucket) bucket.value += 1;
  });
  const normalizedDaily = (daily || []).map((row: any) => ({
    date: row.date, callsMade: row.calls_made || 0, callsAnswered: row.calls_answered || 0,
    meetingsBooked: row.meetings_booked || 0, minutesTalked: row.minutes_talked || 0, costUsd: row.cost_usd || 0,
    costPerMeeting: row.meetings_booked ? row.cost_usd / row.meetings_booked : 0,
  }));
  return NextResponse.json({ summary, daily: normalizedDaily, outcomes, heatmap });
}
