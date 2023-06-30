import { addHandler, handleMessage } from "@lumeweb/libkernel/module";
import type { ActiveQuery } from "@lumeweb/libkernel/module";
import { PeerDiscovery } from "@lumeweb/libpeerdiscovery";
import type { PeerSource, Peer } from "@lumeweb/libpeerdiscovery";
import { callModule, logErr } from "@lumeweb/libkernel";

onmessage = handleMessage;

const discovery = new PeerDiscovery();

function wrapSourceModule(module: string): PeerSource {
  return async (pubkey: Buffer, options = {}): Promise<boolean | Peer> => {
    const [ret, err] = await callModule(module, "discover", {
      pubkey,
      options,
    });
    if (err) {
      logErr(err);
      return false;
    }

    return ret as Peer;
  };
}

async function handleRegisterSource(aq: ActiveQuery): Promise<void> {
  let [name, error] = await callModule(aq.domain, "name");

  if (error) {
    aq.reject(error);
    return;
  }

  if (discovery.sourceExists(name)) {
    aq.reject(`Source ${name} already exists`);
    return;
  }

  discovery.registerSource(name, wrapSourceModule(aq.domain));
  aq.respond();
}

function handleRemoveSource(aq: ActiveQuery): void {
  if (!("name" in aq.callerInput)) {
    aq.reject(`missing name`);
    return;
  }

  aq.respond(discovery.removeSource(aq.callerInput.name));
}

function handleRemoveAllSources(aq: ActiveQuery): void {
  discovery.removeAllSources();

  aq.respond();
}

function handleSourceExists(aq: ActiveQuery): void {
  if (!("name" in aq.callerInput)) {
    aq.reject(`missing name`);
    return;
  }

  aq.respond(discovery.sourceExists(aq.callerInput.name));
}

async function handleDiscover(aq: ActiveQuery) {
  if (!("pubkey" in aq.callerInput)) {
    aq.reject(`missing pubkey`);
    return;
  }

  if (aq.callerInput.pubkey.length !== 32) {
    aq.reject("pubkey must be 32 bytes");
    return;
  }

  if (
    "options" in aq.callerInput &&
    typeof aq.callerInput.options !== "object"
  ) {
    aq.reject(`options must be an object`);
    return;
  }

  const ret = await discovery.discover(
    aq.callerInput.pubkey,
    aq.callerInput.options,
  );

  aq.respond(ret);
}

addHandler("register", handleRegisterSource);
addHandler("remove", handleRemoveSource);
addHandler("removeAll", handleRemoveAllSources);
addHandler("exists", handleSourceExists);
addHandler("discover", handleDiscover);
