/* eslint-disable no-undef */
// Dedicated mock for 'devextreme/ui/notify', kept separate from devextremeMock.js.
// devextremeMock.js is shared by every 'devextreme-react/*' and 'devextreme/*' submodule,
// so a per-test jest.mock() override for one of those paths would otherwise collide with
// this one (Jest keys manual mocks by resolved file path, and moduleNameMapper collapses
// all those specifiers onto the same physical file).
const notify = jest.fn();
notify.__esModule = true;
notify.default = notify;
module.exports = notify;
