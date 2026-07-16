-- 44: idioma da voz (catálogo de Vozes Prontas filtra por PT/ES/EN no combo).
alter table voices add column if not exists language text;
update voices set language = 'pt' where language is null and name like 'Narrador PT%';
update voices set language = 'es' where language is null and name like 'Narrador ES%';
update voices set language = 'en' where language is null and name like 'Narrator EN%';
