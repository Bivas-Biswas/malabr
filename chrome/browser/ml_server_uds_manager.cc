#include "chrome/browser/ml_server_uds_manager.h"

#include "base/command_line.h"
#include "base/path_service.h"
#include "base/process/launch.h"
#include "chrome/common/chrome_features.h"

#if BUILDFLAG(IS_LINUX)
#include "build/build_config.h"
#endif

namespace {
const char kServerPath[] = "addition_malabr/modelserver_uds/app/server.py";
}  // namespace

// Get Singleton instance
MLServerUdsManager& MLServerUdsManager::GetInstance() {
  static MLServerUdsManager instance;
  return instance;
}

// Constructor (Private)
MLServerUdsManager::MLServerUdsManager() = default;

// Destructor (Cleanup process)
MLServerUdsManager::~MLServerUdsManager() {
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

// Start ML Server.
void MLServerUdsManager::StartMLServerIfEnabled() {
  if (!base::FeatureList::IsEnabled(features::kMLServerUdsFeature)) {
    return;
  }

#if BUILDFLAG(IS_LINUX)
  // 1. build the server absolute path
  base::LaunchOptions options;
  base::FilePath project_root;
  CHECK(base::PathService::Get(base::DIR_CURRENT, &project_root));
  base::FilePath server_script = project_root.AppendASCII(kServerPath);

  LOG(INFO) << "Server script path: " << server_script.value();

  // 2. setup the python

  base::CommandLine ml_server_cmd(base::FilePath("python3"));
  ml_server_cmd.AppendArg("-u");
  ml_server_cmd.AppendArg(server_script.value());

  // 3. launch the process
  ml_server_uds_process_ = base::LaunchProcess(ml_server_cmd, options);
  if (!ml_server_uds_process_.IsValid()) {
    LOG(ERROR) << "ML_UDS: Failed to launch the mlserver";
    return;
  }
  LOG(INFO) << "Model server started, pid=" << ml_server_uds_process_.Pid();

#endif
}

// Stop ML Server: Terminate the ml server.
void MLServerUdsManager::StopMLServer() {
#if BUILDFLAG(IS_LINUX)
  if (!ml_server_uds_process_.IsValid()) {
    return;
  }
  LOG(INFO) << "Terminating model server, pid=" << ml_server_uds_process_.Pid();

  ml_server_uds_process_.Terminate(0, false);

#endif
}
