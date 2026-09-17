-- Sprint 62: VAPI voice AI channel for Live Inbox telemetry.

ALTER TYPE communication_channel ADD VALUE IF NOT EXISTS 'voice_ai';

COMMENT ON TYPE communication_channel IS
  'Outbound/inbound communication channel including voice_ai for VAPI recovery calls.';
