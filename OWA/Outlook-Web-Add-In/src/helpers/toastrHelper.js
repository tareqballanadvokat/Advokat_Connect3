 
import toastr from "toastr";
export function setOptions(){
  toastr.options = {
    positionClass: 'toast-bottom-center'
  };

}
export function showSuccess(message){
  // var $notifyContainer = $('#toast-container').closest('.toast-top-center');
  // if ($notifyContainer) {
  //    // align center
  //    var windowHeight = $(window).height() - 90;
  //    $notifyContainer.css("margin-top", windowHeight );
  // }

    toastr.success(message); 
}
// export function showSuccess(message, title){
//       toastr.success(message, title); 
// }

export function showError(message, title){
    console.error(  error);
      toastr.error(message, title); 
}