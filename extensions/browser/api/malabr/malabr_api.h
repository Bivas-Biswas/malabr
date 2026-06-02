#ifndef EXTENSIONS_BROWSER_API_MALABR_API_H_
#define EXTENSIONS_BROWSER_API_MALABR_API_H_
#include <memory>
#include <string>

#include "base/memory/weak_ptr.h"
#include "extensions/browser/api/malabr/mserver_uds.h"
#include "extensions/browser/extension_function.h"

namespace extensions {

// New API for Model FIT.
class MalabrFitFunction : public ExtensionFunction {
 public:
  DECLARE_EXTENSION_FUNCTION("malabr.fit", MALABR_FIT)
  MalabrFitFunction();

 protected:
  ~MalabrFitFunction() override;

 private:
  ResponseAction Run() override;
  void OnResponded() override;

  // Socket handling
  void OnSuccess(std::string result);
  void OnError(std::string error_msg);
  void DispatchRequest(std::vector<uint8_t> payload,
                      std::string extension_id);

  std::unique_ptr<extensions::MServerUDS> ml_server_;
  base::WeakPtrFactory<MalabrFitFunction> weak_ptr_factory_{
      this};
};

// New API for Model SCORE.
class MalabrScoreFunction : public ExtensionFunction {
 public:
  DECLARE_EXTENSION_FUNCTION("malabr.score", MALABR_SCORE)
  MalabrScoreFunction();

 protected:
  ~MalabrScoreFunction() override;

 private:
  ResponseAction Run() override;
  void OnResponded() override;

  // Socket handling
  void OnSuccess(std::string result);
  void OnError(std::string error_msg);
  void DispatchRequest(std::vector<uint8_t> payload, std::string extension_id);

  std::unique_ptr<extensions::MServerUDS> ml_server_;
  base::WeakPtrFactory<MalabrScoreFunction> weak_ptr_factory_{this};
};

// New API for Model PREDICT.
class MalabrPredictFunction : public ExtensionFunction {
 public:
  DECLARE_EXTENSION_FUNCTION("malabr.predict", MALABR_PREDICT)
  MalabrPredictFunction();

 protected:
  ~MalabrPredictFunction() override;

 private:
  ResponseAction Run() override;
  void OnResponded() override;

  // Socket handling
  void OnSuccess(std::string result);
  void OnError(std::string error_msg);
  void DispatchRequest(std::vector<uint8_t> payload, std::string extension_id);

  std::unique_ptr<extensions::MServerUDS> ml_server_;
  base::WeakPtrFactory<MalabrPredictFunction> weak_ptr_factory_{this};
};

// New API for Model CHECKSTATUS.
class MalabrCheckStatusFunction : public ExtensionFunction {
 public:
  DECLARE_EXTENSION_FUNCTION("malabr.checkStatus", MALABR_CHECKSTATUS)
  MalabrCheckStatusFunction();

 protected:
  ~MalabrCheckStatusFunction() override;

 private:
  ResponseAction Run() override;
  void OnResponded() override;

  // Socket handling
  void OnSuccess(std::string result);
  void OnError(std::string error_msg);
  void DispatchRequest(std::vector<uint8_t> payload, std::string extension_id);

  std::unique_ptr<extensions::MServerUDS> ml_server_;
  base::WeakPtrFactory<MalabrCheckStatusFunction> weak_ptr_factory_{this};
};

}  // namespace extensions

#endif  // EXTENSIONS_BROWSER_API_MALABR_API_H_
