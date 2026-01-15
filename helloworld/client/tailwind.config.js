/** @type {import('tailwindcss').Config} */
export default {
    content:[
      "./index.html",
      "./src/**/*.{js,jsx,ts,tsx}"
    ],
    theme:{
      extend:{
        colors:{
          "agri-green":{
            500:"#2ecc71",
            600:"#27ae60"
          },
          "agri-blue":{
            500:"#3b82f6"
          }
        }
      }
    },
    plugins:[]
  };
  