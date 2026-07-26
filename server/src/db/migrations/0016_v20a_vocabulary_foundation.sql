CREATE TABLE vocabulary_topics (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(100) NOT NULL,
  title_vi VARCHAR(160) NOT NULL,
  description_vi VARCHAR(2000) NULL,
  icon_key VARCHAR(50) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_vocabulary_topic_title CHECK (CHAR_LENGTH(TRIM(title_vi)) BETWEEN 1 AND 160),
  CONSTRAINT chk_vocabulary_topic_order CHECK (display_order BETWEEN 1 AND 1000),
  UNIQUE KEY uq_vocabulary_topic_slug (slug),
  UNIQUE KEY uq_vocabulary_topic_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vocabulary_topic_words (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  topic_id BIGINT UNSIGNED NOT NULL,
  word VARCHAR(100) NOT NULL,
  normalized_word VARCHAR(100) NOT NULL,
  meaning_vi VARCHAR(200) NOT NULL,
  normalized_meaning VARCHAR(200) NOT NULL,
  phonetic VARCHAR(100) NULL,
  part_of_speech VARCHAR(50) NULL,
  example_en VARCHAR(500) NULL,
  speech_text VARCHAR(200) NOT NULL,
  tier ENUM('CORE','EXTENDED') NOT NULL,
  core_priority SMALLINT UNSIGNED NULL,
  extension_priority SMALLINT UNSIGNED NULL,
  age_bands_json JSON NOT NULL,
  supports_image_game TINYINT(1) NOT NULL DEFAULT 1,
  image_search_terms_json JSON NOT NULL,
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vocabulary_topic_word_topic FOREIGN KEY (topic_id) REFERENCES vocabulary_topics(id),
  CONSTRAINT chk_vocabulary_topic_word_text CHECK (
    CHAR_LENGTH(TRIM(word)) BETWEEN 1 AND 100
    AND CHAR_LENGTH(TRIM(meaning_vi)) BETWEEN 1 AND 200
    AND CHAR_LENGTH(TRIM(speech_text)) BETWEEN 1 AND 200
  ),
  CONSTRAINT chk_vocabulary_topic_word_priority CHECK (
    (tier='CORE' AND core_priority IS NOT NULL AND extension_priority IS NULL)
    OR (tier='EXTENDED' AND core_priority IS NULL AND extension_priority IS NOT NULL)
  ),
  CONSTRAINT chk_vocabulary_topic_word_image CHECK (supports_image_game IN (0,1)),
  UNIQUE KEY uq_vocabulary_topic_word (topic_id,normalized_word,normalized_meaning),
  UNIQUE KEY uq_vocabulary_topic_core_priority (topic_id,tier,core_priority),
  UNIQUE KEY uq_vocabulary_topic_extension_priority (topic_id,tier,extension_priority),
  INDEX idx_vocabulary_topic_word_age (topic_id,status,tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vocabulary_media (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(50) NULL,
  provider_asset_id VARCHAR(160) NULL,
  source_url VARCHAR(2048) NULL,
  source_page_url VARCHAR(2048) NULL,
  contributor_name VARCHAR(160) NULL,
  contributor_url VARCHAR(2048) NULL,
  attribution_text VARCHAR(500) NULL,
  attribution_url VARCHAR(2048) NULL,
  license_metadata_json JSON NULL,
  storage_path VARCHAR(500) NULL,
  thumbnail_path VARCHAR(500) NULL,
  alt_text VARCHAR(200) NOT NULL,
  mime_type VARCHAR(100) NULL,
  byte_size BIGINT UNSIGNED NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  content_sha256 CHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_vocabulary_media_alt CHECK (CHAR_LENGTH(TRIM(alt_text)) BETWEEN 1 AND 200),
  UNIQUE KEY uq_vocabulary_media_provider_asset (provider,provider_asset_id),
  UNIQUE KEY uq_vocabulary_media_sha256 (content_sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vocabulary_sets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  description VARCHAR(2000) NULL,
  source_type ENUM('TOPIC_CATALOG','PUBLIC_UNIT','COPIED','MANUAL') NOT NULL,
  source_reference_json JSON NULL,
  age_band ENUM('PRESCHOOL_G1','G2_G3','G4_G5','G6_G9') NOT NULL,
  status ENUM('ACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL,
  CONSTRAINT fk_vocabulary_set_teacher FOREIGN KEY (teacher_user_id) REFERENCES users(id),
  CONSTRAINT chk_vocabulary_set_title CHECK (CHAR_LENGTH(TRIM(title)) BETWEEN 1 AND 160),
  CONSTRAINT chk_vocabulary_set_archive CHECK (
    (status='ACTIVE' AND archived_at IS NULL)
    OR (status='ARCHIVED' AND archived_at IS NOT NULL)
  ),
  INDEX idx_vocabulary_set_teacher_status (teacher_user_id,status,updated_at),
  INDEX idx_vocabulary_set_age (teacher_user_id,age_band,status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vocabulary_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vocabulary_set_id BIGINT UNSIGNED NOT NULL,
  source_topic_word_id BIGINT UNSIGNED NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  word VARCHAR(100) NOT NULL,
  normalized_word VARCHAR(100) NOT NULL,
  meaning_vi VARCHAR(200) NOT NULL,
  normalized_meaning VARCHAR(200) NOT NULL,
  phonetic VARCHAR(100) NULL,
  part_of_speech VARCHAR(50) NULL,
  example_en VARCHAR(500) NULL,
  speech_text VARCHAR(200) NOT NULL,
  tier ENUM('CORE','EXTENDED','CUSTOM') NOT NULL,
  illustration_kind ENUM('NONE','EMOJI','PUBLIC_ASSET','STORED_MEDIA') NOT NULL DEFAULT 'NONE',
  illustration_value VARCHAR(500) NULL,
  media_id BIGINT UNSIGNED NULL,
  supports_image_game TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('ACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  archived_at TIMESTAMP NULL,
  CONSTRAINT fk_vocabulary_item_set FOREIGN KEY (vocabulary_set_id) REFERENCES vocabulary_sets(id),
  CONSTRAINT fk_vocabulary_item_topic_word FOREIGN KEY (source_topic_word_id) REFERENCES vocabulary_topic_words(id),
  CONSTRAINT fk_vocabulary_item_media FOREIGN KEY (media_id) REFERENCES vocabulary_media(id),
  CONSTRAINT chk_vocabulary_item_order CHECK (display_order BETWEEN 1 AND 100),
  CONSTRAINT chk_vocabulary_item_text CHECK (
    CHAR_LENGTH(TRIM(word)) BETWEEN 1 AND 100
    AND CHAR_LENGTH(TRIM(meaning_vi)) BETWEEN 1 AND 200
    AND CHAR_LENGTH(TRIM(speech_text)) BETWEEN 1 AND 200
  ),
  CONSTRAINT chk_vocabulary_item_image CHECK (supports_image_game IN (0,1)),
  CONSTRAINT chk_vocabulary_item_illustration CHECK (
    (illustration_kind='NONE' AND illustration_value IS NULL AND media_id IS NULL)
    OR (illustration_kind='EMOJI' AND illustration_value IS NOT NULL AND media_id IS NULL)
    OR (illustration_kind='PUBLIC_ASSET' AND illustration_value LIKE '/learning/%' AND media_id IS NULL)
    OR (illustration_kind='STORED_MEDIA' AND illustration_value IS NULL AND media_id IS NOT NULL)
  ),
  CONSTRAINT chk_vocabulary_item_archive CHECK (
    (status='ACTIVE' AND archived_at IS NULL)
    OR (status='ARCHIVED' AND archived_at IS NOT NULL)
  ),
  INDEX idx_vocabulary_item_set_status_order (vocabulary_set_id,status,display_order),
  INDEX idx_vocabulary_item_normalized (vocabulary_set_id,normalized_word,normalized_meaning)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO vocabulary_topics(slug,title_vi,description_vi,icon_key,display_order) VALUES
('colors','Màu sắc','Màu sắc quen thuộc quanh em.','palette',1),
('numbers-1-20','Số đếm 1–20','Số đếm tiếng Anh từ một đến hai mươi.','numbers',2),
('family','Gia đình','Thành viên trong gia đình.','family',3),
('body','Cơ thể','Các bộ phận cơ thể.','body',4),
('classroom','Lớp học','Đồ vật và người trong lớp học.','school',5),
('toys','Đồ chơi','Đồ chơi quen thuộc.','toys',6),
('pets','Thú cưng','Các loài thú cưng.','pets',7),
('farm-animals','Động vật nông trại','Các con vật ở nông trại.','farm',8),
('wild-animals','Động vật hoang dã','Các loài động vật hoang dã.','wildlife',9),
('fruits','Trái cây','Các loại trái cây quen thuộc.','fruit',10),
('food-and-drinks','Đồ ăn và thức uống','Đồ ăn và thức uống hằng ngày.','food',11),
('clothes','Quần áo','Trang phục và phụ kiện.','clothes',12),
('home','Ngôi nhà','Phòng và đồ vật trong nhà.','home',13),
('weather','Thời tiết','Từ vựng mô tả thời tiết.','weather',14),
('feelings','Cảm xúc','Cảm xúc và trạng thái thường gặp.','feelings',15),
('daily-routines','Hoạt động hằng ngày','Các hoạt động trong ngày.','routine',16),
('actions','Hành động','Các động từ hành động cơ bản.','actions',17),
('transport','Phương tiện','Các phương tiện giao thông.','transport',18),
('nature','Thiên nhiên','Cảnh vật và hiện tượng thiên nhiên.','nature',19),
('places-in-town','Địa điểm trong thành phố','Các địa điểm quen thuộc trong thành phố.','places',20);

INSERT INTO vocabulary_topic_words
  (topic_id,word,normalized_word,meaning_vi,normalized_meaning,speech_text,tier,core_priority,age_bands_json,supports_image_game,image_search_terms_json)
SELECT t.id,j.word,LOWER(TRIM(j.word)),j.meaning,LOWER(TRIM(j.meaning)),j.word,'CORE',j.priority,
  JSON_ARRAY('PRESCHOOL_G1','G2_G3'),1,JSON_ARRAY(CONCAT(j.word,' color'))
FROM vocabulary_topics t JOIN JSON_TABLE(
  '[{"word":"red","meaning":"màu đỏ"},{"word":"blue","meaning":"màu xanh dương"},{"word":"yellow","meaning":"màu vàng"},{"word":"green","meaning":"màu xanh lá"},{"word":"orange","meaning":"màu cam"},{"word":"purple","meaning":"màu tím"},{"word":"pink","meaning":"màu hồng"},{"word":"black","meaning":"màu đen"},{"word":"white","meaning":"màu trắng"},{"word":"brown","meaning":"màu nâu"}]',
  '$[*]' COLUMNS(priority FOR ORDINALITY,word VARCHAR(100) PATH '$.word',meaning VARCHAR(200) PATH '$.meaning')
) j ON TRUE WHERE t.slug='colors';

INSERT INTO vocabulary_topic_words
  (topic_id,word,normalized_word,meaning_vi,normalized_meaning,speech_text,tier,extension_priority,age_bands_json,supports_image_game,image_search_terms_json)
SELECT t.id,j.word,LOWER(TRIM(j.word)),j.meaning,LOWER(TRIM(j.meaning)),j.word,'EXTENDED',j.priority,
  JSON_ARRAY('PRESCHOOL_G1','G2_G3'),1,JSON_ARRAY(CONCAT(j.word,' color'))
FROM vocabulary_topics t JOIN JSON_TABLE(
  '[{"word":"gray","meaning":"màu xám"},{"word":"light blue","meaning":"màu xanh dương nhạt"},{"word":"dark green","meaning":"màu xanh lá đậm"},{"word":"gold","meaning":"màu vàng kim"},{"word":"silver","meaning":"màu bạc"}]',
  '$[*]' COLUMNS(priority FOR ORDINALITY,word VARCHAR(100) PATH '$.word',meaning VARCHAR(200) PATH '$.meaning')
) j ON TRUE WHERE t.slug='colors';

INSERT INTO vocabulary_topic_words
  (topic_id,word,normalized_word,meaning_vi,normalized_meaning,speech_text,tier,core_priority,age_bands_json,supports_image_game,image_search_terms_json)
SELECT t.id,j.word,LOWER(TRIM(j.word)),j.meaning,LOWER(TRIM(j.meaning)),j.word,'CORE',j.priority,
  JSON_ARRAY('PRESCHOOL_G1','G2_G3'),1,JSON_ARRAY(CONCAT(j.word,' number'))
FROM vocabulary_topics t JOIN JSON_TABLE(
  '[{"word":"one","meaning":"số một"},{"word":"two","meaning":"số hai"},{"word":"three","meaning":"số ba"},{"word":"four","meaning":"số bốn"},{"word":"five","meaning":"số năm"},{"word":"six","meaning":"số sáu"},{"word":"seven","meaning":"số bảy"},{"word":"eight","meaning":"số tám"},{"word":"nine","meaning":"số chín"},{"word":"ten","meaning":"số mười"}]',
  '$[*]' COLUMNS(priority FOR ORDINALITY,word VARCHAR(100) PATH '$.word',meaning VARCHAR(200) PATH '$.meaning')
) j ON TRUE WHERE t.slug='numbers-1-20';

INSERT INTO vocabulary_topic_words
  (topic_id,word,normalized_word,meaning_vi,normalized_meaning,speech_text,tier,extension_priority,age_bands_json,supports_image_game,image_search_terms_json)
SELECT t.id,j.word,LOWER(TRIM(j.word)),j.meaning,LOWER(TRIM(j.meaning)),j.word,'EXTENDED',j.priority,
  JSON_ARRAY('PRESCHOOL_G1','G2_G3'),1,JSON_ARRAY(CONCAT(j.word,' number'))
FROM vocabulary_topics t JOIN JSON_TABLE(
  '[{"word":"eleven","meaning":"số mười một"},{"word":"twelve","meaning":"số mười hai"},{"word":"thirteen","meaning":"số mười ba"},{"word":"fourteen","meaning":"số mười bốn"},{"word":"fifteen","meaning":"số mười lăm"},{"word":"sixteen","meaning":"số mười sáu"},{"word":"seventeen","meaning":"số mười bảy"},{"word":"eighteen","meaning":"số mười tám"},{"word":"nineteen","meaning":"số mười chín"},{"word":"twenty","meaning":"số hai mươi"}]',
  '$[*]' COLUMNS(priority FOR ORDINALITY,word VARCHAR(100) PATH '$.word',meaning VARCHAR(200) PATH '$.meaning')
) j ON TRUE WHERE t.slug='numbers-1-20';

INSERT INTO vocabulary_topic_words
  (topic_id,word,normalized_word,meaning_vi,normalized_meaning,speech_text,tier,core_priority,age_bands_json,supports_image_game,image_search_terms_json)
SELECT t.id,j.word,LOWER(TRIM(j.word)),j.meaning,LOWER(TRIM(j.meaning)),j.word,'CORE',j.priority,
  topic_data.age_bands,1,JSON_ARRAY(CONCAT(j.word,' ',t.slug))
FROM vocabulary_topics t JOIN JSON_TABLE(
  '[
    {"slug":"family","age":["PRESCHOOL_G1","G2_G3"],"words":[["mother","mẹ"],["father","bố"],["parents","bố mẹ"],["brother","anh hoặc em trai"],["sister","chị hoặc em gái"],["baby","em bé"],["grandmother","bà"],["grandfather","ông"]]},
    {"slug":"body","age":["PRESCHOOL_G1","G2_G3"],"words":[["head","đầu"],["eye","mắt"],["ear","tai"],["nose","mũi"],["mouth","miệng"],["hand","bàn tay"],["arm","cánh tay"],["leg","chân"],["foot","bàn chân"],["hair","tóc"]]},
    {"slug":"classroom","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["book","sách"],["pen","bút mực"],["pencil","bút chì"],["ruler","thước kẻ"],["eraser","cục tẩy"],["bag","cặp sách"],["desk","bàn học"],["chair","ghế"],["board","bảng"],["teacher","giáo viên"]]},
    {"slug":"toys","age":["PRESCHOOL_G1","G2_G3"],"words":[["ball","quả bóng"],["doll","búp bê"],["kite","con diều"],["car","ô tô đồ chơi"],["robot","rô-bốt"],["teddy bear","gấu bông"],["blocks","bộ xếp hình"],["bike","xe đạp"]]},
    {"slug":"pets","age":["PRESCHOOL_G1","G2_G3"],"words":[["cat","con mèo"],["dog","con chó"],["fish","con cá"],["bird","con chim"],["rabbit","con thỏ"],["hamster","chuột hamster"],["turtle","con rùa"]]},
    {"slug":"farm-animals","age":["PRESCHOOL_G1","G2_G3"],"words":[["cow","con bò"],["pig","con lợn"],["chicken","con gà"],["duck","con vịt"],["horse","con ngựa"],["sheep","con cừu"],["goat","con dê"]]},
    {"slug":"wild-animals","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["lion","sư tử"],["tiger","hổ"],["elephant","voi"],["monkey","khỉ"],["bear","gấu"],["snake","rắn"],["zebra","ngựa vằn"],["giraffe","hươu cao cổ"]]},
    {"slug":"fruits","age":["PRESCHOOL_G1","G2_G3"],"words":[["apple","quả táo"],["banana","quả chuối"],["orange","quả cam"],["mango","quả xoài"],["grape","quả nho"],["watermelon","quả dưa hấu"],["strawberry","quả dâu tây"],["pineapple","quả dứa"]]},
    {"slug":"food-and-drinks","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["rice","cơm"],["bread","bánh mì"],["egg","trứng"],["milk","sữa"],["water","nước"],["juice","nước ép"],["cake","bánh ngọt"],["chicken","thịt gà"],["fish","cá"],["noodles","mì"]]},
    {"slug":"clothes","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["shirt","áo sơ mi"],["T-shirt","áo phông"],["dress","váy liền"],["skirt","chân váy"],["shorts","quần đùi"],["trousers","quần dài"],["shoes","giày"],["hat","mũ"],["jacket","áo khoác"],["socks","tất"]]},
    {"slug":"home","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["house","ngôi nhà"],["bedroom","phòng ngủ"],["bathroom","phòng tắm"],["kitchen","nhà bếp"],["living room","phòng khách"],["bed","giường"],["table","bàn"],["door","cửa ra vào"],["window","cửa sổ"],["garden","khu vườn"]]},
    {"slug":"weather","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["sunny","có nắng"],["rainy","có mưa"],["cloudy","nhiều mây"],["windy","có gió"],["hot","nóng"],["cold","lạnh"],["warm","ấm"],["cool","mát"]]},
    {"slug":"feelings","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["happy","vui"],["sad","buồn"],["angry","tức giận"],["scared","sợ hãi"],["tired","mệt"],["hungry","đói"],["thirsty","khát"],["excited","háo hức"]]},
    {"slug":"daily-routines","age":["G2_G3","G4_G5","G6_G9"],"words":[["wake up","thức dậy"],["brush my teeth","đánh răng"],["have breakfast","ăn sáng"],["go to school","đi học"],["have lunch","ăn trưa"],["do homework","làm bài tập về nhà"],["play","chơi"],["have dinner","ăn tối"],["take a shower","tắm"],["go to bed","đi ngủ"]]},
    {"slug":"actions","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["run","chạy"],["walk","đi bộ"],["jump","nhảy"],["sit","ngồi"],["stand","đứng"],["eat","ăn"],["drink","uống"],["read","đọc"],["write","viết"],["sing","hát"],["dance","nhảy múa"],["swim","bơi"]]},
    {"slug":"transport","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["car","ô tô"],["bus","xe buýt"],["bike","xe đạp"],["motorbike","xe máy"],["train","tàu hỏa"],["plane","máy bay"],["boat","thuyền"],["taxi","taxi"]]},
    {"slug":"nature","age":["G2_G3","G4_G5","G6_G9"],"words":[["sun","mặt trời"],["moon","mặt trăng"],["star","ngôi sao"],["sky","bầu trời"],["tree","cây"],["flower","hoa"],["river","sông"],["mountain","núi"],["sea","biển"],["rain","mưa"]]},
    {"slug":"places-in-town","age":["G2_G3","G4_G5","G6_G9"],"words":[["school","trường học"],["hospital","bệnh viện"],["park","công viên"],["supermarket","siêu thị"],["market","chợ"],["bank","ngân hàng"],["post office","bưu điện"],["library","thư viện"],["restaurant","nhà hàng"],["bus stop","trạm xe buýt"]]}
  ]',
  '$[*]' COLUMNS(
    slug VARCHAR(100) PATH '$.slug',
    age_bands JSON PATH '$.age',
    words JSON PATH '$.words'
  )
) topic_data ON topic_data.slug COLLATE utf8mb4_unicode_ci=t.slug
JOIN JSON_TABLE(
  topic_data.words,'$[*]' COLUMNS(priority FOR ORDINALITY,word VARCHAR(100) PATH '$[0]',meaning VARCHAR(200) PATH '$[1]')
) j ON TRUE;

INSERT INTO vocabulary_topic_words
  (topic_id,word,normalized_word,meaning_vi,normalized_meaning,speech_text,tier,extension_priority,age_bands_json,supports_image_game,image_search_terms_json)
SELECT t.id,j.word,LOWER(TRIM(j.word)),j.meaning,LOWER(TRIM(j.meaning)),j.word,'EXTENDED',j.priority,
  topic_data.age_bands,1,JSON_ARRAY(CONCAT(j.word,' ',t.slug))
FROM vocabulary_topics t JOIN JSON_TABLE(
  '[
    {"slug":"family","age":["PRESCHOOL_G1","G2_G3"],"words":[["aunt","cô hoặc dì"],["uncle","chú hoặc cậu"],["cousin","anh chị em họ"],["son","con trai"],["daughter","con gái"],["family","gia đình"]]},
    {"slug":"body","age":["PRESCHOOL_G1","G2_G3"],"words":[["face","khuôn mặt"],["finger","ngón tay"],["tooth","răng"],["shoulder","vai"],["knee","đầu gối"],["toe","ngón chân"]]},
    {"slug":"classroom","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["notebook","vở"],["crayon","bút sáp màu"],["scissors","cái kéo"],["glue","keo dán"],["computer","máy tính"],["classmate","bạn cùng lớp"]]},
    {"slug":"toys","age":["PRESCHOOL_G1","G2_G3"],"words":[["puzzle","trò ghép hình"],["train","tàu hỏa đồ chơi"],["yo-yo","đồ chơi yo-yo"],["skipping rope","dây nhảy"],["drum","cái trống"]]},
    {"slug":"pets","age":["PRESCHOOL_G1","G2_G3"],"words":[["parrot","con vẹt"],["puppy","chó con"],["kitten","mèo con"],["goldfish","cá vàng"],["pet","thú cưng"]]},
    {"slug":"farm-animals","age":["PRESCHOOL_G1","G2_G3"],"words":[["rooster","gà trống"],["donkey","con lừa"],["calf","bê con"],["farm","nông trại"],["farmer","nông dân"]]},
    {"slug":"wild-animals","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["crocodile","cá sấu"],["panda","gấu trúc"],["kangaroo","chuột túi"],["fox","cáo"],["wolf","sói"],["deer","hươu"]]},
    {"slug":"fruits","age":["PRESCHOOL_G1","G2_G3"],"words":[["pear","quả lê"],["peach","quả đào"],["lemon","quả chanh vàng"],["coconut","quả dừa"],["papaya","quả đu đủ"],["dragon fruit","quả thanh long"]]},
    {"slug":"food-and-drinks","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["soup","súp"],["sandwich","bánh mì kẹp"],["pizza","bánh pizza"],["salad","rau trộn"],["tea","trà"],["coffee","cà phê"],["ice cream","kem"]]},
    {"slug":"clothes","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["coat","áo khoác dài"],["sweater","áo len"],["jeans","quần bò"],["scarf","khăn quàng"],["gloves","găng tay"],["uniform","đồng phục"]]},
    {"slug":"home","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["dining room","phòng ăn"],["balcony","ban công"],["sofa","ghế sofa"],["lamp","đèn"],["wardrobe","tủ quần áo"],["garage","ga-ra"]]},
    {"slug":"weather","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["stormy","có bão"],["snowy","có tuyết"],["foggy","có sương mù"],["weather","thời tiết"],["temperature","nhiệt độ"],["rainbow","cầu vồng"]]},
    {"slug":"feelings","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["bored","chán"],["surprised","ngạc nhiên"],["worried","lo lắng"],["shy","rụt rè"],["proud","tự hào"],["calm","bình tĩnh"]]},
    {"slug":"daily-routines","age":["G2_G3","G4_G5","G6_G9"],"words":[["get dressed","mặc quần áo"],["clean my room","dọn phòng"],["watch TV","xem tivi"],["read a book","đọc sách"],["help my parents","giúp bố mẹ"],["exercise","tập thể dục"]]},
    {"slug":"actions","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["clap","vỗ tay"],["draw","vẽ"],["listen","nghe"],["speak","nói"],["open","mở"],["close","đóng"],["throw","ném"],["catch","bắt"]]},
    {"slug":"transport","age":["PRESCHOOL_G1","G2_G3","G4_G5"],"words":[["truck","xe tải"],["ship","tàu thủy"],["helicopter","trực thăng"],["subway","tàu điện ngầm"],["ambulance","xe cứu thương"],["fire engine","xe cứu hỏa"]]},
    {"slug":"nature","age":["G2_G3","G4_G5","G6_G9"],"words":[["forest","rừng"],["island","hòn đảo"],["lake","hồ"],["waterfall","thác nước"],["field","cánh đồng"],["cloud","đám mây"]]},
    {"slug":"places-in-town","age":["G2_G3","G4_G5","G6_G9"],"words":[["cinema","rạp chiếu phim"],["museum","bảo tàng"],["pharmacy","nhà thuốc"],["police station","đồn cảnh sát"],["bakery","tiệm bánh"]]}
  ]',
  '$[*]' COLUMNS(
    slug VARCHAR(100) PATH '$.slug',
    age_bands JSON PATH '$.age',
    words JSON PATH '$.words'
  )
) topic_data ON topic_data.slug COLLATE utf8mb4_unicode_ci=t.slug
JOIN JSON_TABLE(
  topic_data.words,'$[*]' COLUMNS(priority FOR ORDINALITY,word VARCHAR(100) PATH '$[0]',meaning VARCHAR(200) PATH '$[1]')
) j ON TRUE;
