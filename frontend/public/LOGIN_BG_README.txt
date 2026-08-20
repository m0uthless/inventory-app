Per usare fotografie personalizzate (anche più di una, a rotazione) nella
pagina di login:

1. Scegli una o più immagini in formato JPG
   - Dimensione consigliata: 720×1080 px (portrait) o 1080×1440 px
   - Orientamento verticale per riempire bene il pannello sinistro
   - Soggetti consigliati: architettura, tecnologia, skyline urbano, ospedale

2. Rinomina i file in sequenza contigua a partire da 1:
     login-bg-1.jpg
     login-bg-2.jpg
     login-bg-3.jpg
     ... (fino a un massimo di 12)

3. Copia i file in:
     frontend/public/          (per questo frontend)
     frontend-portal/public/   (per il portale — indipendente, può avere
                                 immagini diverse o un numero diverso)

Il componente le rileva automaticamente all'avvio (si ferma al primo numero
mancante). Con 2 o più immagini trovate, ruotano ogni 5 secondi con
dissolvenza incrociata. Con una sola immagine resta fissa.

Retrocompatibilità: se non trova nessuna login-bg-N.jpg, il componente
ricade sulla vecchia convenzione a singolo file login-bg.jpg. Se non trova
nulla, mostra il gradiente blu di fallback.
