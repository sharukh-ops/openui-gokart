/**
 * The recipe library on the server: the same specs as the browser's
 * gocartLibrary, without the React renderers. Built with @openuidev/lang-core
 * because a route handler cannot import @openuidev/react-lang (it calls React's
 * createContext at import time). tests/server/serverLibrary.test.ts checks that
 * both libraries describe the same components.
 */
import { createLibrary, defineComponent } from "@openuidev/lang-core";
import {
  AreaChartSpec,
  BarChartSpec,
  DashboardSpec,
  LIBRARY,
  PieChartSpec,
  StatCardSpec,
  StatRowSpec,
} from "@/openui/specs";

export const serverLibrary = createLibrary({
  ...LIBRARY,
  components: [
    defineComponent({ ...DashboardSpec, component: null }),
    defineComponent({ ...StatRowSpec, component: null }),
    defineComponent({ ...StatCardSpec, component: null }),
    defineComponent({ ...AreaChartSpec, component: null }),
    defineComponent({ ...BarChartSpec, component: null }),
    defineComponent({ ...PieChartSpec, component: null }),
  ],
});
