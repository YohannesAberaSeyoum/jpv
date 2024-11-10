# JPV Database Design
## Common
- id
- created_at
- updated_at
## Link
- name (text)
- description (text)
- url (text)
## Channel
- name (text)
- description (text)
- url (Link -> id)
- channel_type (enum)
    - link
    - local
- verified (boolean)
- target_id (text)
- icon_url (Link -> id)
- channel_name (text)
## Path
- name (text)
- description (text)
- path_url (text)
- size (bigint)
- parent (Path -> id)
## Video
- name (text)
- video_type (enum)
    - link
    - local
- link (Link -> id)
- path (Path -> id)
- resolution (text)
- duration (bigint)
## Playlist
- name (text)
- description (text)
## Playlist Setting
- playlist (Playlist -> id)
- setting_type (enum)
    - path
    - link
    - last_playlist_detail_id
    - last_playlist_detail_position
- link (Link -> id)
- path (Path -> id)
- last_playlist_detail (Playlist Detail -> id)
- last_playlist_position (bigint)
## Playlist Detail
- playlist (Playlist -> id)
- playlist_detail_type (enum)
    - video
- video (Video -> id)