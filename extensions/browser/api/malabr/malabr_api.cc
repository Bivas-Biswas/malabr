#include "extensions/browser/api/malabr/malabr_api.h"

#include <string>

#include "base/json/json_writer.h"
#include "base/task/thread_pool.h"
#include "base/values.h"
#include "extensions/browser/api/malabr/mserver_uds.h"
#include "extensions/common/api/malabr.h"

namespace extensions {

constexpr char kMLServerUDSPath[] = "/tmp/malabr_v3.sck";

// ALL route for  mserver function handler
constexpr char kMalabrFitRoute[] = "ROUTE_MALABR_FIT_API";
constexpr char kMalabrPredictRoute[] = "ROUTE_MALABR_PREDICT_API";
constexpr char kMalabrScoreRoute[] = "ROUTE_MALABR_SCORE_API";
constexpr char kMalabrCheckStatusRoute[] = "ROUTE_MALABR_CHECK_STATUS_API";


// -------------------------
// FIT API
// -------------------------
MalabrFitFunction::MalabrFitFunction() = default;
MalabrFitFunction::~MalabrFitFunction() {
  if (!did_respond()) {
    LOG(ERROR) << "MalabrFitFunction function destroyed without responding";
    Respond(Error("Function was destroyed without responding"));
  }
}

ExtensionFunction::ResponseAction MalabrFitFunction::Run() {
  const extensions::Extension* ext = extension();
  auto ext_id = ext->id();

  LOG(INFO) << "MalabrFitFunction::Run() called";
  // Validate the presence of arguments
  EXTENSION_FUNCTION_VALIDATE(has_args());
  namespace fit_api = extensions::api::malabr::Fit;

  auto maybe_params = fit_api::Params::Create(args());

  auto payload = maybe_params->request.payload;

  LOG(INFO) << "Received payload: " << payload.data();

  AddRef();
  base::ThreadPool::PostTask(
      FROM_HERE, {base::MayBlock()},
      base::BindOnce(&MalabrFitFunction::DispatchRequest,
                     base::Unretained(this), std::move(payload),
                     std::move(ext_id)));

  return RespondLater();
}

void MalabrFitFunction::DispatchRequest(std::vector<uint8_t> payload, std::string extension_id) {

  auto ml_server = std::make_unique<extensions::MServerUDS>(
      kMLServerUDSPath, kMalabrFitRoute, extension_id);

  int payload_len = payload.size();
  char* payload_ptr = reinterpret_cast<char*>(payload.data());

  std::string error_msg, response;
  int result = ml_server->Send(payload_ptr, payload_len,
                               response, error_msg);

  if (result <= 0) {  // error
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&MalabrFitFunction::OnError,
                       weak_ptr_factory_.GetWeakPtr(), std::move(error_msg)));
  } else {
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&MalabrFitFunction::OnSuccess,
                       weak_ptr_factory_.GetWeakPtr(), std::move(response)));
  }
}

void MalabrFitFunction::OnSuccess(std::string result) {
  LOG(INFO) << "MalabrFitFunction::OnSuccess() Received response: " << result;
  Respond(WithArguments(base::Value(result)));
  Release();
}

void MalabrFitFunction::OnError(std::string error_msg) {
  LOG(ERROR) << "MalabrFitFunction::OnError() Error: " << error_msg;
  Respond(Error(error_msg));
  Release();
}

void MalabrFitFunction::OnResponded() {
  LOG(INFO) << "MalabrFitFunction::OnResponded() Cleaning up";

  if (ml_server_) {
    ml_server_->Clear();  // First clean up state
    ml_server_.reset();   // Then destroy safely
  }

  // Other cleanup if needed
}

// -------------------------
// SCORE API
// -------------------------
MalabrScoreFunction::MalabrScoreFunction() = default;
MalabrScoreFunction::~MalabrScoreFunction() {
  if (!did_respond()) {
    LOG(ERROR) << "MalabrScoreFunction function destroyed without responding";
    Respond(Error("Function was destroyed without responding"));
  }
}

ExtensionFunction::ResponseAction MalabrScoreFunction::Run() {
  const extensions::Extension* ext = extension();
  auto ext_id = ext->id();

  LOG(INFO) << "MalabrScoreFunction::Run() called";
  // Validate the presence of arguments
  EXTENSION_FUNCTION_VALIDATE(has_args());
  namespace score_api = extensions::api::malabr::Score;

  auto maybe_params = score_api::Params::Create(args());

  auto payload = maybe_params->request.payload;

  AddRef();
  base::ThreadPool::PostTask(
      FROM_HERE, {base::MayBlock()},
      base::BindOnce(&MalabrScoreFunction::DispatchRequest,
                     base::Unretained(this), std::move(payload),
                     std::move(ext_id)));

  return RespondLater();
}

void MalabrScoreFunction::DispatchRequest(std::vector<uint8_t> payload,
                                          std::string extension_id) {
  auto ml_server = std::make_unique<extensions::MServerUDS>(
      kMLServerUDSPath, kMalabrScoreRoute, extension_id);

  int payload_len = payload.size();
  char* payload_ptr = reinterpret_cast<char*>(payload.data());

  std::string error_msg, response;
  int result = ml_server->Send(payload_ptr, payload_len,
                               response, error_msg);

  if (result <= 0) {  // error
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&MalabrScoreFunction::OnError,
                       weak_ptr_factory_.GetWeakPtr(), std::move(error_msg)));
  } else {
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&MalabrScoreFunction::OnSuccess,
                       weak_ptr_factory_.GetWeakPtr(), std::move(response)));
  }
}

void MalabrScoreFunction::OnSuccess(std::string result) {
  Respond(WithArguments(base::Value(result)));
  Release();
}

void MalabrScoreFunction::OnError(std::string error_msg) {
  Respond(Error(error_msg));
  Release();
}

void MalabrScoreFunction::OnResponded() {
  LOG(INFO) << "MalabrScoreFunction::OnResponded() Cleaning up";

  if (ml_server_) {
    ml_server_->Clear();  // First clean up state
    ml_server_.reset();   // Then destroy safely
  }

  // Other cleanup if needed
}

// -------------------------
// PREDICT API
// -------------------------
MalabrPredictFunction::MalabrPredictFunction() = default;
MalabrPredictFunction::~MalabrPredictFunction() {
  if (!did_respond()) {
    LOG(ERROR) << "MalabrPredictFunction function destroyed without responding";
    Respond(Error("Function was destroyed without responding"));
  }
}

ExtensionFunction::ResponseAction MalabrPredictFunction::Run() {
  const extensions::Extension* ext = extension();
  auto ext_id = ext->id();

  LOG(INFO) << "MalabrPredictFunction::Run() called";
  // Validate the presence of arguments
  EXTENSION_FUNCTION_VALIDATE(has_args());
  namespace predict_api = extensions::api::malabr::Predict;

  auto maybe_params = predict_api::Params::Create(args());

  auto payload = maybe_params->request.payload;

  AddRef();
  base::ThreadPool::PostTask(
      FROM_HERE, {base::MayBlock()},
      base::BindOnce(&MalabrPredictFunction::DispatchRequest,
                     base::Unretained(this), std::move(payload), std::move(ext_id)));

  return RespondLater();
}

void MalabrPredictFunction::DispatchRequest(std::vector<uint8_t> payload,
                                            std::string extension_id) {
  auto ml_server = std::make_unique<extensions::MServerUDS>(
      kMLServerUDSPath, kMalabrPredictRoute, extension_id);

  int payload_len = payload.size();
  char* payload_ptr = reinterpret_cast<char*>(payload.data());

  std::string error_msg, response;
  int result = ml_server->Send(payload_ptr, payload_len,
                               response, error_msg);

  if (result <= 0) {  // error
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&MalabrPredictFunction::OnError,
                       weak_ptr_factory_.GetWeakPtr(), std::move(error_msg)));
  } else {
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&MalabrPredictFunction::OnSuccess,
                       weak_ptr_factory_.GetWeakPtr(), std::move(response)));
  }
}

void MalabrPredictFunction::OnSuccess(std::string result) {
  Respond(WithArguments(base::Value(result)));
  Release();
}

void MalabrPredictFunction::OnError(std::string error_msg) {
  Respond(Error(error_msg));
  Release();
}

void MalabrPredictFunction::OnResponded() {
  LOG(INFO) << "MalabrPredictFunction::OnResponded() Cleaning up";

  if (ml_server_) {
    ml_server_->Clear();  // First clean up state
    ml_server_.reset();   // Then destroy safely
  }

  // Other cleanup if needed
}

// -------------------------
// CHECKSTATUS API
// -------------------------
MalabrCheckStatusFunction::MalabrCheckStatusFunction() = default;
MalabrCheckStatusFunction::~MalabrCheckStatusFunction() {
  if (!did_respond()) {
    LOG(ERROR) << "MalabrCheckStatusFunction function destroyed without responding";
    Respond(Error("Function was destroyed without responding"));
  }
}

ExtensionFunction::ResponseAction MalabrCheckStatusFunction::Run() {
  const extensions::Extension* ext = extension();
  auto ext_id = ext->id();

  LOG(INFO) << "MalabrCheckStatusFunction::Run() called";
  // Validate the presence of arguments
  EXTENSION_FUNCTION_VALIDATE(has_args());
  namespace checkstatus_api = extensions::api::malabr::CheckStatus;

  auto maybe_params = checkstatus_api::Params::Create(args());

  auto payload = maybe_params->request.payload;

  AddRef();
  base::ThreadPool::PostTask(
      FROM_HERE, {base::MayBlock()},
      base::BindOnce(&MalabrCheckStatusFunction::DispatchRequest,
                     base::Unretained(this), std::move(payload), std::move(ext_id)));

  return RespondLater();
}

void MalabrCheckStatusFunction::DispatchRequest(std::vector<uint8_t> payload,
                                                std::string extension_id) {
  auto ml_server = std::make_unique<extensions::MServerUDS>(
      kMLServerUDSPath, kMalabrCheckStatusRoute, extension_id);

  int payload_len = payload.size();
  char* payload_ptr = reinterpret_cast<char*>(payload.data());

  std::string error_msg, response;
  int result = ml_server->Send(payload_ptr, payload_len,
                               response, error_msg);

  if (result <= 0) {  // error
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&MalabrCheckStatusFunction::OnError,
                       weak_ptr_factory_.GetWeakPtr(), std::move(error_msg)));
  } else {
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&MalabrCheckStatusFunction::OnSuccess,
                       weak_ptr_factory_.GetWeakPtr(), std::move(response)));
  }
}

void MalabrCheckStatusFunction::OnSuccess(std::string result) {
  Respond(WithArguments(base::Value(result)));
  Release();
}

void MalabrCheckStatusFunction::OnError(std::string error_msg) {
  Respond(Error(error_msg));
  Release();
}

void MalabrCheckStatusFunction::OnResponded() {
  LOG(INFO) << "MalabrCheckStatusFunction::OnResponded() Cleaning up";

  if (ml_server_) {
    ml_server_->Clear();  // First clean up state
    ml_server_.reset();   // Then destroy safely
  }

  // Other cleanup if needed
}
}  // namespace extensions
