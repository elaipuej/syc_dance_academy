-- Permite al alumno cancelar solo sus solicitudes pendientes.
-- Los administradores conservan permiso para borrar cualquier solicitud.

drop policy if exists "enrollments_admin_delete" on public.enrollments;
drop policy if exists "enrollments_delete_own_pending_or_admin" on public.enrollments;

create policy "enrollments_delete_own_pending_or_admin" on public.enrollments
for delete to authenticated
using (
  (user_id = (select auth.uid()) and status = 'pending')
  or (select public.is_admin())
);
