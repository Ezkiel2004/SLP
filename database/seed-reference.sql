-- Reference data: real, loaded in every install (spec section 9).

-- The 16 barangays of Lubang, in alphabetical order (ids 1-16).
-- Names follow the DBM barangay list; the MSWDO confirms the spelling.
INSERT INTO barangays (name, is_poblacion) VALUES
  ('Araw at Bituin', 1),
  ('Bagong Sikat', 1),
  ('Banaag at Pag-asa', 1),
  ('Binakas', 0),
  ('Cabra', 0),
  ('Likas ng Silangan', 1),
  ('Maginhawa', 1),
  ('Maligaya', 0),
  ('Maliig', 0),
  ('Ninikat ng Pag-asa', 1),
  ('Paraiso', 1),
  ('Surville', 1),
  ('Tagbac', 0),
  ('Tangal', 0),
  ('Tilik', 0),
  ('Vigo', 0);

-- Livelihood types (ids 1-7). Staff add more from the app.
INSERT INTO livelihood_types (name) VALUES
  ('Sari-sari Store'),
  ('Poultry Raising'),
  ('Piggery'),
  ('Food Vending'),
  ('Fishing'),
  ('Livestock Raising'),
  ('Farming');
