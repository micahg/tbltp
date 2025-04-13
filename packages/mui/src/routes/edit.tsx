import GameMasterComponent from "../components/GameMasterComponent/GameMasterComponent";

export async function clientLoader() {
  return {
    title: "Content Editor",
  };
}

export default function Edit() {
  return <GameMasterComponent />;
}
