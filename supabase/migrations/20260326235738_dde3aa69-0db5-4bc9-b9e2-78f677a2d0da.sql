
-- Enable realtime for whatsapp_conversas only (whatsapp_chat_mensagens is a view)
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversas;
