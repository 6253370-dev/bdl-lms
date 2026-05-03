
-- Storage bucket for certificate templates
INSERT INTO storage.buckets (id, name, public) VALUES ('certificate-templates', 'certificate-templates', true)
ON CONFLICT (id) DO NOTHING;

-- Table to track uploaded templates
CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('pdf','pptx')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view (so users see active template if needed)
CREATE POLICY "Templates viewable by authenticated"
ON public.certificate_templates FOR SELECT TO authenticated USING (true);

-- Only admins/super_admins can manage
CREATE POLICY "Admins can insert templates"
ON public.certificate_templates FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins can update templates"
ON public.certificate_templates FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "Admins can delete templates"
ON public.certificate_templates FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin'));

-- Storage policies
CREATE POLICY "Templates publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'certificate-templates');

CREATE POLICY "Admins can upload templates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'certificate-templates'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));

CREATE POLICY "Admins can delete template files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'certificate-templates'
  AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'super_admin')));
