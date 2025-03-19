open Eio.Std
open Piaf

let start_pos = Atomic.make_contended 0 (* between 0 and 1000, actual value between 0.0 and 1.0, increments by 0.001 *)
let end_pos = Atomic.make_contended 1000 (* between 0 and 1000 *)
let zoom = Atomic.make_contended 30 (* between 0 and 300, actual value betwen 0.0 and 30.0, increments by 0.1 *)
let ending = Atomic.make_contended false
let silence = Atomic.make_contended false

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
    let silence_str = if (Atomic.get silence) then "true" else "false" in
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
  | "/u23/silence/true" -> Atomic.set silence true
  | "/u23/silence/false" -> Atomic.set silence false
  | _ -> ()

let receive_updates wsd () =
  let frames = Ws.Descriptor.messages wsd in
  Stream.iter ~f:handle_message frames;
  Ws.Descriptor.close wsd

let connection_handler (params : Request_info.t Server.ctx) =
  Response.Upgrade.websocket params.request ~f:(fun wsd ->
    Fiber.both (send_updates wsd) (receive_updates wsd))
  |> Result.get_ok

let start env =
  let host = Eio.Net.Ipaddr.V4.loopback in
  let port = 8080 in
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
