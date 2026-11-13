[out:json][timeout:300];
area["boundary"="administrative"]["admin_level"="8"]["name"="Rio de Janeiro"]->.rio;
rel["boundary"="administrative"]["admin_level"~"^(9|10)$"](area.rio);
out geom;
