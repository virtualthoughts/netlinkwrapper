#include <node.h>
#include "netlinkwrapper.h"


extern "C" NODE_MODULE_EXPORT
void NODE_MODULE_INITIALIZER(v8::Local<v8::Object> exports,
                             v8::Local<v8::Value> module,
                             v8::Local<v8::Context> context)
{
    NL::init();
    NetLinkWrapper::init(exports);
}
