const util = require("util");
const exec = util.promisify(require("child_process").exec);

const BASE_COMMAND = "way";
const UPDATE_WAYSTATION = `${BASE_COMMAND} update`;
const VALIDATE_WAYSTATION = `${BASE_COMMAND} validate`;
const CURRENT_WAYSTATION_AS_JSON = `${BASE_COMMAND} -j`;
const ADD_MARK = `${BASE_COMMAND} mark`;
const LIST_WAYSTATIONS = `${BASE_COMMAND} open -j`;
const NEW_WAYSTATION = `${BASE_COMMAND} new`;
const OPEN_WAYSTATION = `${BASE_COMMAND} open`;

async function addMark(
  path: string,
  line = 1,
  column = 1,
  context = "",
) {
  context = context.replaceAll('"', '\\"');
  await exec(
    `${ADD_MARK} "${path}:${line}:${column}:${context}"`,
  );
}

async function currentWaystation() {
  const { stdout } = await exec(CURRENT_WAYSTATION_AS_JSON);
  return JSON.parse(stdout);
}

async function listWaystations() {
  const { stdout } = await exec(LIST_WAYSTATIONS);
  return JSON.parse(stdout);
}

async function newWaystation(name: string) {
  const { stdout } = await exec(`${NEW_WAYSTATION} '${name}'`);
  return stdout;
}

async function openWaystation(uid: string) {
  const { stdout } = await exec(`${OPEN_WAYSTATION} '${uid}'`);
  return stdout;
}

async function updateWaystation(waystation: Record<string, unknown>) {
  const waystationJson = JSON.stringify(waystation);
  const { stdout } = await exec(`${UPDATE_WAYSTATION} ${waystationJson}`);
  return JSON.parse(stdout);
}

async function validateWaystation(waystation: Record<string, unknown>) {
  const waystationJson = JSON.stringify(waystation);
  const { stdout } = await exec(`${VALIDATE_WAYSTATION} ${waystationJson}`);
  return JSON.parse(stdout);
}

async function validateAndUpdateWaystation(
  waystation: Record<string, unknown>,
) {
  const validationOutput = await validateWaystation(waystation);
  if (validationOutput.success) {
    const updatedWaystation = await updateWaystation(waystation);
    return { ...validationOutput, waystation: updatedWaystation };
  } else {
    return validationOutput;
  }
}

export default {
  addMark,
  currentWaystation,
  validateAndUpdateWaystation,
  listWaystations,
  newWaystation,
  openWaystation,
};
