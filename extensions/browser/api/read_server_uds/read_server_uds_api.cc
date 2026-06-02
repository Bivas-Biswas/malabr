#include "extensions/browser/api/read_server_uds/read_server_uds_api.h"

#include <string>

#include "base/json/json_writer.h"
#include "base/task/thread_pool.h"
#include "base/values.h"
#include "extensions/browser/api/read_server_uds/ml_server_uds_v2.h"
#include "extensions/common/api/read_server_uds.h"
#include "extensions/common/extension_id.h"
#include "extensions/common/utils/extension_utils.h"

/// tmp/shared-sockets/echo_socket
namespace extensions {

constexpr char kMLServerUDSPath[] = "/tmp/malabr.sck";

// ALL lable for ML server function handler
constexpr char kReadServerUdsReadDataFunctionLable[] = "LABEL_READ_DATA";
constexpr char kReadServerUdsSendDataFunctionLable[] = "LABEL_SEND_DATA";
constexpr char kReadServerUdsLoadModelBERTFunctionLable[] =
    "LABEL_LOAD_MODEL_BERT";
constexpr char kReadServerUdsInferSingleBERTFunctionLable[] =
    "LABEL_INFER_MODEL_BERT";

// -------------------------
// Read Server Read Data UDS
// -------------------------
ReadServerUdsReadDataFunction::ReadServerUdsReadDataFunction() = default;

ReadServerUdsReadDataFunction::~ReadServerUdsReadDataFunction() {
  if (!did_respond()) {
    LOG(ERROR) << "Function was destroyed without responding";
    Respond(Error("Function was destroyed without responding"));
  }
}

ExtensionFunction::ResponseAction ReadServerUdsReadDataFunction::Run() {
  AddRef();  // async

  std::string payload = "GET /data\n";

  base::ThreadPool::PostTask(
      FROM_HERE, {base::MayBlock()},
      base::BindOnce(&ReadServerUdsReadDataFunction::DispatchRequest,
                     base::Unretained(this), std::move(payload)));
  return RespondLater();
}

void ReadServerUdsReadDataFunction::DispatchRequest(std::string payload) {
  auto ml_server = std::make_unique<extensions::MLServerUDSV2>(
      kMLServerUDSPath, kReadServerUdsReadDataFunctionLable);

  std::string error_msg, response;
  int result = ml_server->Send(payload.data(), payload.size(), "fb-read",
                               response, error_msg);

  if (result <= 0) {  // error
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&ReadServerUdsReadDataFunction::OnError,
                       weak_ptr_factory_.GetWeakPtr(), std::move(error_msg)));
  } else {
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&ReadServerUdsReadDataFunction::OnSuccess,
                       weak_ptr_factory_.GetWeakPtr(), std::move(response)));
  }
}

void ReadServerUdsReadDataFunction::OnSuccess(std::string result) {
  Respond(WithArguments(base::Value(result)));
  Release();
}

void ReadServerUdsReadDataFunction::OnError(std::string error_msg) {
  Respond(Error(error_msg));
  Release();
}

void ReadServerUdsReadDataFunction::OnResponded() {
  LOG(INFO) << "ReadServerUdsReadDataFunction::OnResponded() Cleaning up";

  if (ml_server_) {
    ml_server_->Clear();  // First clean up state
    ml_server_.reset();   // Then destroy safely
  }

  // Other cleanup if needed
}

// -------------------------
// Read Server Send Data UDS
// -------------------------
// Constructor for ReadServerUdsSendDataFunction
ReadServerUdsSendDataFunction::ReadServerUdsSendDataFunction() = default;

// Destructor for ReadServerUdsSendDataFunction
ReadServerUdsSendDataFunction::~ReadServerUdsSendDataFunction() {
  if (!did_respond()) {
    LOG(ERROR) << "Function was destroyed without responding";
    Respond(Error("Function was destroyed without responding"));
  }
}

ExtensionFunction::ResponseAction ReadServerUdsSendDataFunction::Run() {
  LOG(INFO) << "ReadServerUdsSendDataFunction::Run() called";

  // Validate the presence of arguments
  EXTENSION_FUNCTION_VALIDATE(has_args());
  namespace send_data_api = extensions::api::read_server_uds::SendData;

  auto maybe_params = send_data_api::Params::Create(args());
  EXTENSION_FUNCTION_VALIDATE(maybe_params);

  const std::string payload = maybe_params->data;

  AddRef();  // async

  base::ThreadPool::PostTask(
      FROM_HERE, {base::MayBlock()},
      base::BindOnce(&ReadServerUdsSendDataFunction::DispatchRequest,
                     base::Unretained(this), std::move(payload)));

  return RespondLater();
}

void ReadServerUdsSendDataFunction::DispatchRequest(std::string payload) {
  auto ml_server = std::make_unique<extensions::MLServerUDSV2>(
      kMLServerUDSPath, kReadServerUdsSendDataFunctionLable);

  std::string error_msg, response;
  int result = ml_server->Send(payload.data(), payload.size(), "fb-read",
                               response, error_msg);

  if (result <= 0) {  // error
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&ReadServerUdsSendDataFunction::OnError,
                       weak_ptr_factory_.GetWeakPtr(), std::move(error_msg)));
  } else {
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&ReadServerUdsSendDataFunction::OnSuccess,
                       weak_ptr_factory_.GetWeakPtr(), std::move(response)));
  }
}

void ReadServerUdsSendDataFunction::OnSuccess(std::string result) {
  Respond(WithArguments(base::Value(result)));
  Release();
}

void ReadServerUdsSendDataFunction::OnError(std::string error_msg) {
  Respond(Error(error_msg));
  Release();
}

void ReadServerUdsSendDataFunction::OnResponded() {
  LOG(INFO) << "ReadServerUdsSendDataFunction::OnResponded() Cleaning up";

  if (ml_server_) {
    ml_server_->Clear();  // First clean up state
    ml_server_.reset();   // Then destroy safely
  }

  // Other cleanup if needed
}

// -------------------------
// Load Model BERT Endpoint
// -------------------------
ReadServerUdsLoadModelBERTFunction::ReadServerUdsLoadModelBERTFunction() =
    default;
ReadServerUdsLoadModelBERTFunction::~ReadServerUdsLoadModelBERTFunction() {
  if (!did_respond()) {
    LOG(ERROR) << "LoadModelBERT function destroyed without responding";
    Respond(Error("Function was destroyed without responding"));
  }
}

ExtensionFunction::ResponseAction ReadServerUdsLoadModelBERTFunction::Run() {
  LOG(INFO) << "ReadServerUdsLoadModelBERTFunction::Run() called";
  AddRef();

  std::string payload = "init the bert model\n";

  base::ThreadPool::PostTask(
      FROM_HERE, {base::MayBlock()},
      base::BindOnce(&ReadServerUdsLoadModelBERTFunction::DispatchRequest,
                     base::Unretained(this), std::move(payload)));
  return RespondLater();
}

void ReadServerUdsLoadModelBERTFunction::DispatchRequest(std::string payload) {
  auto ml_server = std::make_unique<extensions::MLServerUDSV2>(
      kMLServerUDSPath, kReadServerUdsLoadModelBERTFunctionLable);

  std::string error_msg, response;
  int result = ml_server->Send(payload.data(), payload.size(), "fb-load",
                               response, error_msg);

  if (result <= 0) {  // error
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&ReadServerUdsLoadModelBERTFunction::OnError,
                       weak_ptr_factory_.GetWeakPtr(), std::move(error_msg)));
  } else {
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&ReadServerUdsLoadModelBERTFunction::OnSuccess,
                       weak_ptr_factory_.GetWeakPtr(), std::move(response)));
  }
}

void ReadServerUdsLoadModelBERTFunction::OnSuccess(std::string result) {
  Respond(WithArguments(base::Value(result)));
  Release();
}

void ReadServerUdsLoadModelBERTFunction::OnError(std::string error_msg) {
  Respond(Error(error_msg));
  Release();
}

void ReadServerUdsLoadModelBERTFunction::OnResponded() {
  LOG(INFO) << "ReadServerUdsLoadModelBERTFunction::OnResponded() Cleaning up";

  if (ml_server_) {
    ml_server_->Clear();  // First clean up state
    ml_server_.reset();   // Then destroy safely
  }

  // Other cleanup if needed
}

// -------------------------
// Single Inference BERT Endpoint
// -------------------------
ReadServerUdsInferSingleBERTFunction::ReadServerUdsInferSingleBERTFunction() =
    default;
ReadServerUdsInferSingleBERTFunction::~ReadServerUdsInferSingleBERTFunction() {
  if (!did_respond()) {
    LOG(ERROR) << "InferSingleBERT function destroyed without responding";
    Respond(Error("Function was destroyed without responding"));
  }
}

ExtensionFunction::ResponseAction ReadServerUdsInferSingleBERTFunction::Run() {
  LOG(INFO) << "ReadServerUdsInferSingleBERTFunction::Run() called";
  // Validate the presence of arguments
  EXTENSION_FUNCTION_VALIDATE(has_args());
  namespace infer_single_bert_api =
      extensions::api::read_server_uds::InferSingleBERT;

  auto maybe_params = infer_single_bert_api::Params::Create(args());

  auto payload = maybe_params->request.payload;
  std::string fb_file_identifier = maybe_params->request.fb_id;

  AddRef();
  base::ThreadPool::PostTask(
      FROM_HERE, {base::MayBlock()},
      base::BindOnce(&ReadServerUdsInferSingleBERTFunction::DispatchRequest,
                     base::Unretained(this), std::move(payload),
                     std::move(fb_file_identifier)));

  return RespondLater();
}

void ReadServerUdsInferSingleBERTFunction::DispatchRequest(
    std::vector<uint8_t> payload,
    std::string fb_file_identifier) {
  auto ml_server = std::make_unique<extensions::MLServerUDSV2>(
      kMLServerUDSPath, kReadServerUdsInferSingleBERTFunctionLable);

  int payload_len = payload.size();
  char* payload_ptr = reinterpret_cast<char*>(payload.data());

  std::string error_msg, response;
  int result = ml_server->Send(payload_ptr, payload_len, fb_file_identifier,
                               response, error_msg);

  if (result <= 0) {  // error
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&ReadServerUdsInferSingleBERTFunction::OnError,
                       weak_ptr_factory_.GetWeakPtr(), std::move(error_msg)));
  } else {
    content::GetUIThreadTaskRunner({})->PostTask(
        FROM_HERE,
        base::BindOnce(&ReadServerUdsInferSingleBERTFunction::OnSuccess,
                       weak_ptr_factory_.GetWeakPtr(), std::move(response)));
  }
}

void ReadServerUdsInferSingleBERTFunction::OnSuccess(std::string result) {
  Respond(WithArguments(base::Value(result)));
  Release();
}

void ReadServerUdsInferSingleBERTFunction::OnError(std::string error_msg) {
  Respond(Error(error_msg));
  Release();
}

void ReadServerUdsInferSingleBERTFunction::OnResponded() {
  LOG(INFO)
      << "ReadServerUdsInferSingleBERTFunction::OnResponded() Cleaning up";

  if (ml_server_) {
    ml_server_->Clear();  // First clean up state
    ml_server_.reset();   // Then destroy safely
  }

  // Other cleanup if needed
}
}  // namespace extensions
