open Eio.Std
open Piaf

(* files to serve *)

let read_file filename =
  let f = open_in filename in
  let s = really_input_string f (in_channel_length f) in
  close_in f;
  s

let admin_html = read_file "admin.html"
let ake_metalhit_wav = read_file "ake_metalhit.wav"
let custom_css = read_file "custom.css"
let index_html = read_file "index.html"
let latoregular_ttf = read_file "latoregular.ttf"
let latoregular_woff = read_file "latoregular.woff"
let tibetan_bell_wav = read_file "tibetan_bell.wav"
let tone_js = read_file "tone.js"
let untitled23_client_js = read_file "untitled23_client.js"
let sporkl_css_chota_css = read_file "sporkl-css/chota.css"
let sporkl_css_sporkl_css = read_file "sporkl-css/sporkl.css"

(* code *)

let start_pos = Atomic.make_contended 0 (* between 0 and 1000, actual value between 0.0 and 1.0, increments by 0.001 *)
let end_pos = Atomic.make_contended 1000 (* between 0 and 1000 *)
let zoom = Atomic.make_contended 30 (* between 0 and 300, actual value betwen 0.0 and 30.0, increments by 0.1 *)
let ending = Atomic.make_contended false
let silence = Atomic.make_contended 0

let atomic_get_clip_range a lo hi =
  let v = Atomic.get a in
  if v < lo then
    (Atomic.set a lo; lo)
  else if v > hi then
    (Atomic.set a hi; hi)
  else
    v

let send_updates wsd () =
  while not (Ws.Descriptor.is_closed wsd) do
    let zoom_str = string_of_int @@ atomic_get_clip_range zoom 1 300 in
    let start_pos_str = string_of_int @@ atomic_get_clip_range start_pos 0 1000 in
    let end_pos_str = string_of_int @@ atomic_get_clip_range end_pos 0 1000 in
    let silence_str = string_of_int @@ Atomic.get silence in
    let json_string = String.concat "" [
      {|{"start_pos":|}
    ; start_pos_str
    ; {|,"end_pos":|}
    ; end_pos_str
    ; {|,"zoom":|}
    ; zoom_str
    ; {|,"silence":|}
    ; silence_str
    ; {|}|}
    ]
    in
    Ws.Descriptor.send_string wsd json_string;
    Eio_unix.sleep 0.1;
  done

let handle_message (_opcode, {IOVec.buffer; off; len}) =
  match Bigstringaf.substring ~off ~len buffer with
  | "/u23/start_pos/incr" -> Atomic.incr start_pos
  | "/u23/start_pos/decr" -> (if (Atomic.get ending) then Atomic.incr else Atomic.decr) start_pos
  | "/u23/end_pos/incr" -> Atomic.incr end_pos
  | "/u23/end_pos/decr" -> (if (Atomic.get ending) then Atomic.incr else Atomic.decr) end_pos
  | "/u23/zoom/incr" -> (if (Atomic.get ending) then Atomic.decr else Atomic.incr) zoom
  | "/u23/zoom/decr" -> Atomic.decr zoom
  | "/u23/ending/true" -> Atomic.set ending true
  | "/u23/ending/false" -> Atomic.set ending false
  | "/u23/silence/0" -> Atomic.set silence 0
  | "/u23/silence/1" -> Atomic.set silence 1
  | "/u23/silence/2" -> Atomic.set silence 2
  | _ -> ()

let receive_updates wsd () =
  let frames = Ws.Descriptor.messages wsd in
  Stream.iter ~f:handle_message frames;
  Ws.Descriptor.close wsd

let websocket_connection_handler (params : Request_info.t Server.ctx) =
  Response.Upgrade.websocket params.request ~f:(fun wsd ->
    Fiber.both (send_updates wsd) (receive_updates wsd))
  |> Result.get_ok

let connection_handler (params : Request_info.t Server.ctx) =
  match params.request.target with
  | "/ws" -> websocket_connection_handler params
  | "/admin.html" -> Response.of_string ~body:admin_html `OK
  | "/ake_metalhit.wav" -> Response.of_string ~body:ake_metalhit_wav `OK
  | "/custom.css" -> Response.of_string ~body:custom_css `OK
  | "/index.html" | "/" -> Response.of_string ~body:index_html `OK
  | "/latoregular.ttf" -> Response.of_string ~body:latoregular_ttf `OK
  | "/latoregular.woff" -> Response.of_string ~body:latoregular_woff `OK
  | "/tibetan_bell.wav" -> Response.of_string ~body:tibetan_bell_wav `OK
  | "/tone.js" -> Response.of_string ~body:tone_js `OK
  | "/untitled23_client.js" -> Response.of_string ~body:untitled23_client_js `OK
  | "/sporkl-css/chota.css" -> Response.of_string ~body:sporkl_css_chota_css `OK
  | "/sporkl-css/sporkl.css" -> Response.of_string ~body:sporkl_css_sporkl_css `OK
  | _ -> Response.create `Not_found

(* GO FORM DEFINE connection_handler *)

let start env =
  let host = Eio.Net.Ipaddr.V4.any in
  let port = 8000 in
  Eio.Flow.copy_string ("Port: " ^ (string_of_int port) ^ "\n") (Eio.Stdenv.stdout env);
  Switch.run (fun sw ->
    let config =
      Server.Config.create
        ~domains:(Domain.recommended_domain_count ())
        (`Tcp (host, port))
    in
    let server = Server.create ~config connection_handler in
    ignore (Server.Command.start ~sw env server))

let () =
  Eio_main.run start
