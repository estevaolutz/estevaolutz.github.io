[out:json][timeout:300];
area["boundary"="administrative"]["admin_level"="4"]["name"="Rio de Janeiro"]->.rj;
rel["type"="route"]["route"~"^(subway|train|light_rail|tram|ferry)$"](area.rj)->.rotas;
.rotas out body;
.rotas >;
out body qt;
rel["type"="route_master"](br.rotas);
out body;
(
  nwr["railway"~"^(station|halt|tram_stop)$"](area.rj);
  nwr["amenity"="ferry_terminal"](area.rj);
);
out center tags;
