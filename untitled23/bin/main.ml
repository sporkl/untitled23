open Eio.Std
open Piaf

let start_pos = Atomic.make_contended 0
let end_pos = Atomic.make_contended 0
let zoom = Atomic.make_contended 1

let send_updates wsd () =
  while not (Ws.Descriptor.is_closed wsd) do
    Ws.Descriptor.send_string wsd ("/u23_client/start_pos " ^ (string_of_int @@ Atomic.get start_pos));
    Ws.Descriptor.send_string wsd ("/u23_client/end_pos " ^ (string_of_int @@ Atomic.get end_pos));
    Ws.Descriptor.send_string wsd ("/u23_client/zoom " ^ (string_of_int @@ Atomic.get zoom));
    Eio_unix.sleep 0.1;
  done

let handle_message (_opcode, {IOVec.buffer; off; len}) =
  match Bigstringaf.substring ~off ~len buffer with
  | "/u23/start_pos/incr" -> Atomic.incr start_pos
  | "/u23/start_pos/decr" -> Atomic.decr start_pos
  | "/u23/end_pos/incr" -> Atomic.incr end_pos
  | "/u23/end_pos/decr" -> Atomic.decr end_pos
  | "/u23/zoom/incr" -> Atomic.incr zoom
  | "/u23/zoom/decr" -> Atomic.decr zoom
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
