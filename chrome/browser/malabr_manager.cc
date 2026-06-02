#include "chrome/browser/malabr_manager.h"

#include "base/command_line.h"
#include "base/path_service.h"
#include "base/process/launch.h"
#include "chrome/common/chrome_features.h"

#if BUILDFLAG(IS_LINUX)
#include "build/build_config.h"
#endif

namespace {
const char kMServerUDSPath[] = "addition_malabr/mserver/app.py";
}  // namespace

// Get Singleton instance
MalabrManager& MalabrManager::GetInstance() {
  static MalabrManager minstance;
  return minstance;
}

// Constructor (Private)
MalabrManager::MalabrManager() = default;

// Destructor (Cleanup process)
MalabrManager::~MalabrManager() {
  StopMLServer();
}

// void LogPaths() {
//   base::FilePath path;

//   if (base::PathService::Get(base::DIR_EXE, &path)) {
//     LOG(INFO)
//         << "DIR_EXE: "
//         << path.value();  // Print:
//                           // /home/bivas_lappy/Desktop/malabr/src/out/Default
//   }

//   if (base::PathService::Get(base::DIR_HOME, &path)) {
//     LOG(INFO) << "DIR_HOME: " << path.value();  // Print: /home/bivas_lappy
//   }

//   if (base::PathService::Get(base::DIR_CURRENT, &path)) {
//     LOG(INFO) << "DIR_CURRENT: "
//               << path.value();  // Print:
//               /home/bivas_lappy/Desktop/malabr/src
//   }
// }

// Start mServer.
void MalabrManager::StartMLServerIfEnabled() {
  if (!base::FeatureList::IsEnabled(features::kMalabrFeature)) {
    return;
  }

#if BUILDFLAG(IS_LINUX)
  // 1. build the server absolute path
  base::LaunchOptions options;
  base::FilePath project_root;
  CHECK(base::PathService::Get(base::DIR_CURRENT, &project_root));
  base::FilePath server_script = project_root.AppendASCII(kMServerUDSPath);

  LOG(INFO) << "Server script path: " << server_script.value();

  // 2. setup the python

  base::CommandLine mserver_cmd(base::FilePath("python3"));
  mserver_cmd.AppendArg("-u");
  mserver_cmd.AppendArg(server_script.value());

  // 3. launch the process
  mserver_uds_process_ = base::LaunchProcess(mserver_cmd, options);
  if (!mserver_uds_process_.IsValid()) {
    LOG(ERROR) << "MalabrManager: Failed to launch the mserver";
    return;
  }
  LOG(INFO) << "Model server started, pid=" << mserver_uds_process_.Pid();

#endif
}

// Stop ML Server: Terminate the ml server.
void MalabrManager::StopMLServer() {
#if BUILDFLAG(IS_LINUX)
  if (!mserver_uds_process_.IsValid()) {
    return;
  }
  LOG(INFO) << "Terminating model server, pid=" << mserver_uds_process_.Pid();

  mserver_uds_process_.Terminate(0, false);

#endif
}
