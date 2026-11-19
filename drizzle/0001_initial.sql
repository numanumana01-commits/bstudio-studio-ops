create table studio_state (id integer primary key check (id = 1), version text not null);
--> statement-breakpoint
create table studio_chunk (version text not null, part integer not null, data text not null, primary key(version, part));
