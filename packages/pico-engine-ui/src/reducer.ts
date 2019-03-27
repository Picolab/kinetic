import produce from "immer";
import { Action } from "./Action";
import {
  initialState,
  State,
  apiCallStatus,
  PicoBox,
  PicoState
} from "./State";

/**
 * The root reducer
 */
export default function reducer(
  stateIn: State = initialState,
  action: Action
): State {
  const state = produce(stateIn, draft => producer(draft, action));
  console.log(action.type, stateIn, state);

  return state;
}

/**
 * Reducers done the easy way.
 *
 * @param state an immer "draft" of the global state you can mutate
 * @param action
 * @returns nothing b/c you should mutate the state "draft"
 */
function producer(state: State, action: Action): void {
  switch (action.type) {
    case "GET_UI_CONTEXT_START":
      state.uiContext_apiSt = apiCallStatus.waiting();
      return;
    case "GET_UI_CONTEXT_OK":
      state.uiContext_apiSt = apiCallStatus.ok();
      state.uiContext = action.data;
      return;
    case "GET_UI_CONTEXT_ERROR":
      state.uiContext_apiSt = apiCallStatus.error(action.error);
      return;

    case "START_PICO_MOVE":
      state.pico_moving = action.eci;
      state.pico_resizing = undefined;
      return;

    case "START_PICO_RESIZE":
      state.pico_moving = undefined;
      state.pico_resizing = action.eci;
      return;

    case "PICOS_MOUSE_MOVE":
      if (state.pico_moving) {
        updatePicoBox(state, state.pico_moving, box => {
          box.x = action.x;
          box.y = action.y;
        });
      } else if (state.pico_resizing) {
        updatePicoBox(state, state.pico_resizing, box => {
          box.width = Math.max(0, action.x - box.x);
          box.height = Math.max(0, action.y - box.y);
        });
      }
      return;

    case "PICOS_MOUSE_UP":
      state.pico_moving = undefined;
      state.pico_resizing = undefined;
      return;

    case "GET_PICOBOX_START":
      updatePico(state, action.eci, pico => {
        pico.box_apiSt = apiCallStatus.waiting();
      });
      return;
    case "GET_PICOBOX_OK":
      updatePico(state, action.eci, pico => {
        pico.box_apiSt = apiCallStatus.ok();
        pico.box = action.data;
      });
      return;
    case "GET_PICOBOX_ERROR":
      updatePico(state, action.eci, pico => {
        pico.box_apiSt = apiCallStatus.error(action.error);
      });
      return;

    case "PUT_PICOBOX_START":
      updatePico(state, action.eci, pico => {
        pico.box_apiSt = apiCallStatus.waiting();
      });
      return;
    case "PUT_PICOBOX_OK":
      updatePico(state, action.eci, pico => {
        pico.box_apiSt = apiCallStatus.ok();
        pico.box = action.data;
      });
      return;
    case "PUT_PICOBOX_ERROR":
      updatePico(state, action.eci, pico => {
        pico.box_apiSt = apiCallStatus.error(action.error);
      });
      return;

    case "NEW_PICO_START":
      updatePico(state, action.eci, pico => {
        pico.new_apiSt = apiCallStatus.waiting();
      });
      return;
    case "NEW_PICO_OK":
      updatePico(state, action.eci, pico => {
        pico.new_apiSt = apiCallStatus.ok();
        pico.box = action.data;
      });
      return;
    case "NEW_PICO_ERROR":
      updatePico(state, action.eci, pico => {
        pico.new_apiSt = apiCallStatus.error(action.error);
      });
      return;

    case "DEL_PICO_START":
      // TODO api status for delete?
      return;
    case "DEL_PICO_OK":
      if (state.picos[action.parentEci]) {
        const pico = state.picos[action.parentEci];
        if (pico.box) {
          pico.box.children = pico.box.children.filter(
            eci => eci !== action.eci
          );
        }
      }
      delete state.picos[action.eci];
      return;
    case "DEL_PICO_ERROR":
      // TODO api status for delete?
      return;

    case "GET_PICODETAILS_START":
      updatePico(state, action.eci, pico => {
        pico.details_apiSt = apiCallStatus.waiting();
      });
      return;
    case "GET_PICODETAILS_OK":
      updatePico(state, action.eci, pico => {
        pico.details_apiSt = apiCallStatus.ok();
        pico.details = action.data;
      });
      return;
    case "GET_PICODETAILS_ERROR":
      updatePico(state, action.eci, pico => {
        pico.details_apiSt = apiCallStatus.error(action.error);
      });
      return;

    case "GET_RULESETS_START":
      state.rulesets_apiSt = apiCallStatus.init();
      return;
    case "GET_RULESETS_OK":
      state.rulesets_apiSt = apiCallStatus.ok();
      state.rulesets = action.data;
      return;
    case "GET_RULESETS_ERROR":
      state.rulesets_apiSt = apiCallStatus.error(action.error);
      return;

    case "INSTALL_RULESET_START":
      updatePico(state, action.eci, pico => {
        pico.install_apiSt = apiCallStatus.waiting();
      });
      return;
    case "INSTALL_RULESET_OK":
      updatePico(state, action.eci, pico => {
        pico.install_apiSt = apiCallStatus.ok();
        pico.details = action.data;
      });
      return;
    case "INSTALL_RULESET_ERROR":
      updatePico(state, action.eci, pico => {
        pico.install_apiSt = apiCallStatus.error(action.error);
      });
      return;

    case "UNINSTALL_RULESET_START":
      updatePico(state, action.eci, pico => {
        pico.uninstall_apiSt = apiCallStatus.waiting();
      });
      return;
    case "UNINSTALL_RULESET_OK":
      updatePico(state, action.eci, pico => {
        pico.uninstall_apiSt = apiCallStatus.ok();
        pico.details = action.data;
      });
      return;
    case "UNINSTALL_RULESET_ERROR":
      updatePico(state, action.eci, pico => {
        pico.uninstall_apiSt = apiCallStatus.error(action.error);
      });
      return;

    case "NEW_CHANNEL_START":
      updatePico(state, action.eci, pico => {
        pico.addChannel_apiSt = apiCallStatus.waiting();
      });
      return;
    case "NEW_CHANNEL_OK":
      updatePico(state, action.eci, pico => {
        pico.addChannel_apiSt = apiCallStatus.ok();
        pico.details = action.data;
      });
      return;
    case "NEW_CHANNEL_ERROR":
      updatePico(state, action.eci, pico => {
        pico.addChannel_apiSt = apiCallStatus.error(action.error);
      });
      return;

    case "DEL_CHANNEL_START":
      updatePico(state, action.eci, pico => {
        pico.delChannel_apiSt = apiCallStatus.waiting();
      });
      return;
    case "DEL_CHANNEL_OK":
      updatePico(state, action.eci, pico => {
        pico.delChannel_apiSt = apiCallStatus.ok();
        pico.details = action.data;
      });
      return;
    case "DEL_CHANNEL_ERROR":
      updatePico(state, action.eci, pico => {
        pico.delChannel_apiSt = apiCallStatus.error(action.error);
      });
      return;

    case "GET_TESTING_START":
      updatePicoTesting(state, action.eci, action.rid, testing => {
        testing.schema_apiSt = apiCallStatus.waiting();
      });
      return;
    case "GET_TESTING_OK":
      updatePicoTesting(state, action.eci, action.rid, testing => {
        testing.schema_apiSt = apiCallStatus.ok();
        testing.schema = action.data;
      });
      return;
    case "GET_TESTING_ERROR":
      updatePicoTesting(state, action.eci, action.rid, testing => {
        testing.schema_apiSt = apiCallStatus.error(action.error);
      });
      return;

    case "TEST_RESULT_CLEAR":
      updatePico(state, action.eci, pico => {
        delete pico.testResult_error;
        delete pico.testResult;
      });
      return;
    case "TEST_RESULT_OK":
      updatePico(state, action.eci, pico => {
        delete pico.testResult_error;
        pico.testResult = action.data;
      });
      return;
    case "TEST_RESULT_ERROR":
      updatePico(state, action.eci, pico => {
        pico.testResult_error = action.error;
      });
      return;
  }
}

function updatePicoBox(
  state: State,
  eci: string,
  update: (box: PicoBox) => void
) {
  const pico = state.picos[eci];
  if (pico && pico.box) {
    update(pico.box);
  }
}

function updatePico(
  state: State,
  eci: string,
  update: (pico: PicoState) => void
) {
  let pico = state.picos[eci];
  if (!pico) {
    pico = {
      details_apiSt: apiCallStatus.init(),
      box_apiSt: apiCallStatus.init(),
      new_apiSt: apiCallStatus.init(),
      install_apiSt: apiCallStatus.init(),
      uninstall_apiSt: apiCallStatus.init(),
      addChannel_apiSt: apiCallStatus.init(),
      delChannel_apiSt: apiCallStatus.init(),
      testing: {}
    };
    state.picos[eci] = pico;
  }
  update(pico);
}

function updatePicoTesting(
  state: State,
  eci: string,
  rid: string,
  update: (testing: PicoState["testing"][string]) => void
) {
  updatePico(state, eci, pico => {
    if (!pico.testing[rid]) {
      pico.testing[rid] = {
        schema_apiSt: apiCallStatus.init()
      };
    }
    update(pico.testing[rid]);
  });
}
