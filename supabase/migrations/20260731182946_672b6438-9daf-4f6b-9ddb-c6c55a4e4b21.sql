CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created ON public.notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type_related_created ON public.notifications (type, related_id, created_at DESC);
DELETE FROM public.notifications WHERE is_read = true AND created_at < now() - interval '60 days';