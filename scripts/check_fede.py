from django.contrib.auth import get_user_model
from portal.models import PortalUserProfile

U = get_user_model()
u = U.objects.get(username="fede")

print("is_superuser:", u.is_superuser)
print("is_staff:", u.is_staff)
print("has core.access_archie:", u.has_perm("core.access_archie"))
print("gruppi:", list(u.groups.values_list("name", flat=True)))
print("permessi diretti (non da gruppo):", list(
    u.user_permissions.values_list("content_type__app_label", "codename")
))

prof = PortalUserProfile.objects.filter(user=u).first()
if prof:
    print("profilo Portal is_active:", prof.is_active)
    print("customer default:", prof.customer_id, prof.customer)
    print("customers assegnati:", list(prof.customers.values_list("id", "name")))
else:
    print("NESSUN profilo Portal per questo utente")
