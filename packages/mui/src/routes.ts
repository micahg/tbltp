import { index, type RouteConfig } from "@react-router/dev/routes";
export default [
  index("./routes/layout.tsx"),
  // route("/", "./routes/layout.tsx", [route("edit", "./routes/edit.tsx")]),
  // {
  //   path: "/",
  //   file: "./routes/layout.tsx",
  //   children: [
  //     {
  //       path: "edit",
  //       file: "./routes/edit.tsx",
  //     },
  //   ],
  // },
] satisfies RouteConfig;
