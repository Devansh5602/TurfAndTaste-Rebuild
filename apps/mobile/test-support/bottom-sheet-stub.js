/**
 * Test-only stand-in for `@gorhom/bottom-sheet`.
 *
 * The bottom sheet pulls in `react-native-gesture-handler`, which needs the
 * native renderer shim at runtime. Screens under test never open a sheet, so
 * the module is replaced with a render-safe stub instead of loading it.
 */
'use strict';

function BottomSheetStub() {
  return null;
}

module.exports = {
  __esModule: true,
  default: BottomSheetStub,
  BottomSheetView: BottomSheetStub,
  BottomSheetModal: BottomSheetStub,
  BottomSheetModalProvider: function BottomSheetModalProvider({ children }) {
    return children;
  },
};
