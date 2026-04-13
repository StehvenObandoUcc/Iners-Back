// ⚠️ DEPRECATED: Este DTO no se usa en ningun controller.
// La posicion se lee de req.params.position, no del body.
// Se mantiene solo como referencia documental.
export interface AddSongAtPositionRequest {
  songId: number;
  position: number;
}
