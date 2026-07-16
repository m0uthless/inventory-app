"""Paginazione di default dell'API.

Perche' questo file esiste
--------------------------
Il progetto usava `rest_framework.pagination.PageNumberPagination` cosi' com'e',
configurando nel dict REST_FRAMEWORK:

    "PAGE_SIZE": 25,
    "PAGE_SIZE_QUERY_PARAM": "page_size",
    "MAX_PAGE_SIZE": 200,

Ma DRF legge dai settings **solo** PAGE_SIZE. `page_size_query_param` e
`max_page_size` sono attributi di CLASSE del paginatore, non chiavi di settings:
PAGE_SIZE_QUERY_PARAM e MAX_PAGE_SIZE erano quindi due chiavi inerti, ignorate.

Il risultato e' che `page_size_query_param` restava al suo default (None), e in
DRF:

    def get_page_size(self, request):
        if self.page_size_query_param:   # None -> ramo mai preso
            ...
        return self.page_size            # -> 25, sempre

cioe' **il parametro ?page_size= veniva ignorato su tutta l'API** e ogni lista
paginata restituiva 25 righe, qualunque cosa chiedesse il frontend. Effetti:

- i contatori e la ricerca del Site Repository giravano su 25 inventory invece
  che su tutti quelli del cliente -> numeri sbagliati;
- le tendine di lookup che chiedevano page_size=500 mostravano 25 opzioni;
- il selettore "righe per pagina" dei DataGrid era inefficace (il server tornava
  comunque 25).

Questa classe rende effettivi entrambi i parametri, leggendoli dai settings cosi'
che restino configurabili da un unico punto.
"""
from django.conf import settings
from rest_framework.pagination import PageNumberPagination


def _drf_setting(key, default):
    return (getattr(settings, "REST_FRAMEWORK", {}) or {}).get(key, default)


class StandardResultsPagination(PageNumberPagination):
    """PageNumberPagination con ?page_size= realmente attivo e un tetto massimo.

    Il tetto (`max_page_size`) e' importante: senza, un `?page_size=100000`
    materializzerebbe l'intera tabella in memoria. DRF applica il cap in
    silenzio (`_positive_int(..., cutoff=max_page_size)`), quindi una richiesta
    oltre il limite non fallisce: viene semplicemente servita al massimo
    consentito.
    """

    page_size = _drf_setting("PAGE_SIZE", 25)
    page_size_query_param = _drf_setting("PAGE_SIZE_QUERY_PARAM", "page_size")
    max_page_size = _drf_setting("MAX_PAGE_SIZE", 200)
